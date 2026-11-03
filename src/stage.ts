// The GPU side: darktable's colorize as one inline fragment in the host's
// display-adjust phase, the point in Safelight's pipeline that matches
// darktable's Lab section (display-referred, after the tone transform, before
// vignette and grain), ordered after the Colour Correction port as darktable's
// pipe orders the two modules. There is no prepass; the work is per pixel.
//
// The display colour `c` arrives sRGB-encoded. The stage declares the display's
// own space, so on process version 2 the host hands it unclipped. The branch
// decodes it with the host's curve extended both ways (sign kept, no ceiling),
// takes it to D50 Lab through darktable's matrix, colorises it, and encodes it
// back the same way, so values past white and colours outside sRGB come out as
// darktable's Lab modules leave them, unclipped; on [0, 1] the curves are the
// host's srgbToLinear and linearToSrgb. Declaring the linear encoding instead
// would convert every pixel on every photo, rounding the idle stage's output
// and costing two pows while it does nothing. Photos on process version 1
// keep the shader they were edited with, which clipped `c` to [0, 1] and used
// the host's clipping curves (SL_PROCESS_VERSION picks the path). The tint's
// Lab is computed from the hue, saturation and lightness uniforms in the
// shader (uniform arithmetic the driver hoists), so the bag holds darktable's
// own params and a preset that carries only some of them still renders right. Every constant is formatted
// from the model's numbers, so the shader and the CPU reference cannot drift.
// At opacity 0 the branch is not taken and the stage is a bit-exact no-op.

import type { ProcessingStageContribution, UniformDeclaration } from "./safelight";
import {
  D50_WHITE,
  DEFAULT_PARAMS,
  LAB_CBRT_EPSILON,
  LAB_EPSILON,
  LAB_KAPPA,
  SRGB_TO_XYZ_D50,
  XYZ_D50_TO_SRGB,
} from "./model";
import { PARAM_KEYS, STAGE_ID, type ParamKey } from "./params";

/** A GLSL float literal at full single precision, always with a decimal point
 *  (GLSL ES never promotes an integer literal to float). */
export function glslLiteral(v: number): string {
  const s = v.toPrecision(10);
  return s.includes("e") ? v.toFixed(12) : s;
}

/** A row-major 3×3 as a GLSL mat3 constructor (column-major arguments). */
function glslMat3(rowMajor: readonly number[]): string {
  const cols = [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => glslLiteral(rowMajor[i]));
  return `mat3(${cols.join(", ")})`;
}

const EPS = glslLiteral(LAB_EPSILON);
const CBRT_EPS = glslLiteral(LAB_CBRT_EPSILON);
const KAPPA = glslLiteral(LAB_KAPPA);
const WHITE = `vec3(${D50_WHITE.map(glslLiteral).join(", ")})`;

// Parameter and local names stay clear of the uniform keys, which the host
// rewrites at identifier boundaries.
const HELPERS = `
#if SL_PROCESS_VERSION >= 2
vec3 czDecode(vec3 y) {
  vec3 a = abs(y);
  return sign(y) * mix(a / 12.92, pow((a + 0.055) / 1.055, vec3(2.4)), step(0.04045, a));
}
vec3 czEncode(vec3 x) {
  vec3 a = abs(x);
  return sign(x) * mix(a * 12.92, 1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, a));
}
#endif
float czF(float t) {
  return t > ${EPS} ? pow(t, 1.0 / 3.0) : (${KAPPA} * t + 16.0) / 116.0;
}
float czFInv(float f) {
  return f > ${CBRT_EPS} ? f * f * f : (116.0 * f - 16.0) / ${KAPPA};
}
vec3 czLab(vec3 rgb) {
  const mat3 toXyz = ${glslMat3(SRGB_TO_XYZ_D50)};
  vec3 r = (toXyz * rgb) / ${WHITE};
  vec3 f = vec3(czF(r.x), czF(r.y), czF(r.z));
  return vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
}
vec3 czRgb(vec3 lab) {
  const mat3 toRgb = ${glslMat3(XYZ_D50_TO_SRGB)};
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  return toRgb * (vec3(czFInv(fx), czFInv(fy), czFInv(fz)) * ${WHITE});
}
float czHue2Rgb(float m1, float m2, float angle) {
  if (angle < 1.0) return m1 + (m2 - m1) * angle;
  if (angle < 3.0) return m2;
  return angle < 4.0 ? m1 + (m2 - m1) * (4.0 - angle) : m1;
}
vec3 czHsl2Rgb(float h, float s, float l) {
  if (s <= 0.0) return vec3(l);
  float m2 = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float m1 = 2.0 * l - m2;
  float angle = h * 6.0;
  return vec3(
    czHue2Rgb(m1, m2, angle < 4.0 ? angle + 2.0 : angle - 4.0),
    czHue2Rgb(m1, m2, angle),
    czHue2Rgb(m1, m2, angle > 2.0 ? angle - 2.0 : angle + 4.0));
}
`;

// colorize.c process(): L' = L_tint − (mix · 100) / 2 + L · mix, a' = a_tint,
// b' = b_tint, with mix = sourceMix / 100; then darktable's normal Lab blend.
const INLINE = `
{
  if (opacity > 0.0) {
#if SL_PROCESS_VERSION >= 2
    vec3 lab = czLab(czDecode(c));
#else
    vec3 lab = czLab(srgbToLinear(clamp(c, 0.0, 1.0)));
#endif
    vec3 tint = czLab(czHsl2Rgb(hue, saturation, lightness * 0.01));
    vec3 coloured = vec3(tint.x - sourceMix * 0.5 + lab.x * sourceMix * 0.01, tint.y, tint.z);
#if SL_PROCESS_VERSION >= 2
    c = czEncode(czRgb(mix(lab, coloured, opacity * 0.01)));
#else
    c = linearToSrgb(czRgb(mix(lab, coloured, opacity * 0.01)));
#endif
  }
}
`;

const RANGES: Record<ParamKey, { min: number; max: number; step: number }> = {
  hue: { min: 0, max: 1, step: 0.001 },
  saturation: { min: 0, max: 1, step: 0.01 },
  lightness: { min: 0, max: 100, step: 1 },
  sourceMix: { min: 0, max: 100, step: 1 },
  opacity: { min: 0, max: 100, step: 1 },
};

const LABELS: Record<ParamKey, string> = {
  hue: "hue",
  saturation: "saturation",
  lightness: "lightness",
  sourceMix: "source mix",
  opacity: "opacity",
};

const UNIFORMS: UniformDeclaration[] = PARAM_KEYS.map((key) => ({
  key,
  glslType: "float",
  default: DEFAULT_PARAMS[key],
  range: RANGES[key],
  label: LABELS[key],
}));

export function coloriseStage(): ProcessingStageContribution {
  return {
    id: STAGE_ID,
    name: "Colorise",
    phase: "display-adjust",
    space: { encoding: "perceptual" },
    glsl: INLINE,
    helpers: HELPERS,
    uniforms: UNIFORMS,
    presetScope: "global",
    // A mask's copy runs at the defaults until its opacity moves, so the gate
    // keeps an untouched mask bit-exact too.
    mask: { maskable: true },
    after: ["colour-correction.lab"],
  };
}
