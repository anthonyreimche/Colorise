// The maths of darktable's colorize module, reimplemented. darktable's
// `colorize` IOP (GPL-3.0) lays one solid colour over the image in Lab: the
// colour is an HSL triple taken as linear Rec.709 and converted to D50 Lab,
// every pixel takes its a and b, and its L is the colour's L shifted by the
// image's own lightness in proportion to the source mix. Safelight adds the
// blend opacity darktable users apply the module through, so the stage idles
// at the defaults. The functions, constants and order of operations are the
// C's.
//
// References: darktable src/iop/colorize.c (params version 2),
// src/common/colorspaces.h (hue2rgb, hsl2rgb, rgb2hsl) and
// src/common/colorspaces_inline_conversions.h (dt_Rec709_to_XYZ_D50,
// dt_XYZ_to_Lab, dt_Lab_to_XYZ).

export interface Params {
  /** A turn, 0..1 (darktable shows it in degrees). */
  hue: number;
  /** 0..1. */
  saturation: number;
  /** 0..100 %. */
  lightness: number;
  /** 0..100 %: how much of the image's lightness is kept (darktable's "source mix"). */
  sourceMix: number;
  /** 0..100 %: darktable's blend opacity; 0 leaves the image untouched. */
  opacity: number;
}

export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze({
  hue: 0,
  saturation: 0.5,
  lightness: 50,
  sourceMix: 50,
  opacity: 0,
});

export type Vec3 = readonly [number, number, number];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── HSL (colorspaces.h) ──────────────────────────────────────────────────────

/** `angle` is the hue pre-scaled to 0..6, as hsl2rgb hands it over. */
export function hue2rgb(m1: number, m2: number, angle: number): number {
  if (angle < 1) return m1 + (m2 - m1) * angle;
  if (angle < 3) return m2;
  return angle < 4 ? m1 + (m2 - m1) * (4 - angle) : m1;
}

export function hsl2rgb(h: number, s: number, l: number): Vec3 {
  if (s <= 0) return [l, l, l];
  const m2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  const angle = h * 6;
  return [
    hue2rgb(m1, m2, angle < 4 ? angle + 2 : angle - 4),
    hue2rgb(m1, m2, angle),
    hue2rgb(m1, m2, angle > 2 ? angle - 2 : angle + 4),
  ];
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** darktable floors the saturation divisor at 2^-16 so near-black stays finite. */
const HSL_DIVISOR_FLOOR = 1.52587890625e-5;

export function rgb2hsl([r, g, b]: Vec3): Hsl {
  const pmax = Math.max(r, g, b);
  const pmin = Math.min(r, g, b);
  const delta = pmax - pmin;
  const l = (pmin + pmax) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s =
    l < 0.5
      ? delta / Math.max(pmax + pmin, HSL_DIVISOR_FLOOR)
      : delta / Math.max(2 - pmax - pmin, HSL_DIVISOR_FLOOR);
  let h = pmax === r ? (g - b) / delta : pmax === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
  h /= 6;
  if (h < 0) h += 1;
  else if (h > 1) h -= 1;
  return { h, s, l };
}

// ── transfer functions (the host shader's srgbToLinear / linearToSrgb) ───────

export function srgbToLinear(v: number): number {
  return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v: number): number {
  const c = clamp01(v);
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ── Lab, D50 (colorspaces_inline_conversions.h) ──────────────────────────────

/** darktable's `d50`. */
export const D50_WHITE: Vec3 = [0.9642, 1.0, 0.8249];

/** `sRGB_to_xyz_transposed` read row-major: linear Rec.709 → XYZ D50. */
export const SRGB_TO_XYZ_D50: readonly number[] = [
  0.4360747, 0.3850649, 0.1430804,
  0.2225045, 0.7168786, 0.0606169,
  0.0139322, 0.0971045, 0.7141733,
];

function invert3(m: readonly number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/** XYZ D50 → linear Rec.709: the exact inverse of SRGB_TO_XYZ_D50, so the
 *  round trip is exact rather than a second rounded table. */
export const XYZ_D50_TO_SRGB: readonly number[] = invert3(SRGB_TO_XYZ_D50);

export const LAB_EPSILON = 216 / 24389;
export const LAB_KAPPA = 24389 / 27;
/** lab_f_inv's threshold: cbrt(epsilon), darktable's 0.20689655172413796f. */
export const LAB_CBRT_EPSILON = Math.cbrt(LAB_EPSILON);

function mul3(m: readonly number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const labF = (t: number): number => (t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);
const labFInv = (f: number): number => (f > LAB_CBRT_EPSILON ? f * f * f : (116 * f - 16) / LAB_KAPPA);

export function labFromLinearSrgb(rgb: Vec3): Vec3 {
  const xyz = mul3(SRGB_TO_XYZ_D50, rgb);
  const fx = labF(xyz[0] / D50_WHITE[0]);
  const fy = labF(xyz[1] / D50_WHITE[1]);
  const fz = labF(xyz[2] / D50_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function linearSrgbFromLab([L, a, b]: Vec3): Vec3 {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return mul3(XYZ_D50_TO_SRGB, [labFInv(fx) * D50_WHITE[0], labFInv(fy) * D50_WHITE[1], labFInv(fz) * D50_WHITE[2]]);
}

// ── colorize.c ───────────────────────────────────────────────────────────────

/** commit_params: the colour's Lab. */
export function tintLab(p: Params): Vec3 {
  return labFromLinearSrgb(hsl2rgb(p.hue, p.saturation, p.lightness / 100));
}

/** process, then the blend: L' = L_tint − 50·mix + L·mix, a' = a_tint,
 *  b' = b_tint, mixed over the input by the opacity as GLSL's mix() does. */
export function coloriseLab(lab: Vec3, p: Params): Vec3 {
  const [L, a, b] = tintLab(p);
  const mixL = p.sourceMix / 100;
  const coloured: Vec3 = [L - (mixL * 100) / 2 + lab[0] * mixL, a, b];
  const t = p.opacity / 100;
  return [
    lab[0] * (1 - t) + coloured[0] * t,
    lab[1] * (1 - t) + coloured[1] * t,
    lab[2] * (1 - t) + coloured[2] * t,
  ];
}

/** The whole per-pixel path the shader runs, on a display-encoded pixel:
 *  clip, decode, Lab, darktable's colorize, back, encode (clipping to gamut). */
export function colorisePixel(c: Vec3, p: Params): Vec3 {
  const lin: Vec3 = [srgbToLinear(clamp01(c[0])), srgbToLinear(clamp01(c[1])), srgbToLinear(clamp01(c[2]))];
  const rgb = linearSrgbFromLab(coloriseLab(labFromLinearSrgb(lin), p));
  return [linearToSrgb(rgb[0]), linearToSrgb(rgb[1]), linearToSrgb(rgb[2])];
}
