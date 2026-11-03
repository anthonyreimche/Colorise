// The GPU stage as a contract: one inline display-adjust stage on the
// perceptual encoding, maskable, ordered after Colour Correction as in
// darktable's pipe; its uniforms exactly the bag keys with darktable's
// defaults; gated off at opacity 0 and carrying signed, over-range values
// through its Lab round trip unclipped;
// no texture fetches or loops; decimal-point literals; its colour constants
// formatted from the model so the shader and the CPU reference cannot drift;
// and no helper parameter or local named after a key the host rewrites.

import { describe, expect, it } from "vitest";
import {
  D50_WHITE,
  LAB_CBRT_EPSILON,
  LAB_EPSILON,
  LAB_KAPPA,
  SRGB_TO_XYZ_D50,
  XYZ_D50_TO_SRGB,
} from "../src/model";
import { PARAM_KEYS, STAGE_ID } from "../src/params";
import { coloriseStage, glslLiteral } from "../src/stage";
import manifest from "../safelight.json";

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const uses = (src: string, ident: string) => new RegExp(`\\b${ident}\\b`).test(src);

/** The source as the host's GLSL preprocessor leaves it for a photo at
 *  `version`: the `#if SL_PROCESS_VERSION >= n` branches resolved and the
 *  directive lines gone. */
function forVersion(src: string, version: number): string {
  const taking: boolean[] = [];
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const open = /^\s*#if SL_PROCESS_VERSION >= (\d+)\s*$/.exec(line);
    if (open) taking.push(version >= Number(open[1]));
    else if (/^\s*#else\s*$/.test(line)) taking.push(!taking.pop());
    else if (/^\s*#endif\s*$/.test(line)) taking.pop();
    else if (taking.every(Boolean)) out.push(line);
  }
  expect(taking).toEqual([]);
  return out.join("\n");
}

// Colorise 1.0.0's shader, which process version 1 photos keep: it clipped
// the display colour to [0, 1] and decoded and encoded it with the host's
// curves, the encode clipping again.
const V1_INLINE = `
{
  if (opacity > 0.0) {
    vec3 lab = czLab(srgbToLinear(clamp(c, 0.0, 1.0)));
    vec3 tint = czLab(czHsl2Rgb(hue, saturation, lightness * 0.01));
    vec3 coloured = vec3(tint.x - sourceMix * 0.5 + lab.x * sourceMix * 0.01, tint.y, tint.z);
    c = linearToSrgb(czRgb(mix(lab, coloured, opacity * 0.01)));
  }
}
`;

const stage = coloriseStage();
const inline = strip(forVersion(stage.glsl, 2));
const helpers = strip(forVersion(stage.helpers ?? "", 2));
const all = `${helpers}\n${inline}`;

describe("glslLiteral", () => {
  it("always carries a decimal point", () => {
    expect(glslLiteral(0)).toBe("0.000000000");
    expect(glslLiteral(1)).toBe("1.000000000");
    expect(glslLiteral(0.5)).toBe("0.5000000000");
    expect(glslLiteral(50)).toBe("50.00000000");
  });
});

describe("colorise stage", () => {
  it("is one inline display-adjust stage on the perceptual encoding, maskable, after Colour Correction", () => {
    expect(stage.id).toBe(STAGE_ID);
    expect(stage.name).toBe("Colorise");
    expect(stage.phase).toBe("display-adjust");
    expect(stage.space).toEqual({ encoding: "perceptual" });
    expect(stage.mask).toEqual({ maskable: true });
    expect(stage.after).toEqual(["colour-correction.lab"]);
    expect(stage.presetScope).toBe("global");
    expect(Object.keys(stage).sort()).toEqual(["after", "glsl", "helpers", "id", "mask", "name", "phase", "presetScope", "space", "uniforms"]);
  });

  it("declares the five bag keys as float uniforms with darktable's defaults and ranges", () => {
    expect(stage.uniforms.map((u) => u.key)).toEqual([...PARAM_KEYS]);
    for (const u of stage.uniforms) {
      expect(u.glslType).toBe("float");
      expect(typeof u.label).toBe("string");
      expect(u.label?.length).toBeGreaterThan(0);
    }
    const byKey = Object.fromEntries(stage.uniforms.map((u) => [u.key, u]));
    expect(byKey.hue).toMatchObject({ default: 0, range: { min: 0, max: 1 } });
    expect(byKey.saturation).toMatchObject({ default: 0.5, range: { min: 0, max: 1 } });
    expect(byKey.lightness).toMatchObject({ default: 50, range: { min: 0, max: 100 } });
    expect(byKey.sourceMix).toMatchObject({ default: 50, range: { min: 0, max: 100 }, label: "source mix" });
    expect(byKey.opacity).toMatchObject({ default: 0, range: { min: 0, max: 100 } });
  });

  it("every key drives the inline GLSL", () => {
    for (const key of PARAM_KEYS) expect(uses(inline, key)).toBe(true);
  });

  it("is gated on the opacity and decodes and encodes signed values, clipping nothing", () => {
    expect(inline).toMatch(/if \(opacity > 0\.0\) \{\s*vec3 lab = czLab\(czDecode\(c\)\);/);
    expect(inline).toMatch(/c = czEncode\(czRgb\(mix\(lab, coloured, opacity \* 0\.01\)\)\);/);
    expect(all).not.toMatch(/\b(clamp|saturate|min|max|linearToSrgb|srgbToLinear)\s*\(/);
  });

  it("renders Colorise 1.0.0's clipping shader on process version 1, character for character", () => {
    expect(forVersion(stage.glsl, 1)).toBe(V1_INLINE);
    const v2Helpers = forVersion(stage.helpers ?? "", 2);
    expect(forVersion(stage.helpers ?? "", 1)).toBe(v2Helpers.replace(/\nvec3 czDecode\([\s\S]*?\n\}\nvec3 czEncode\([\s\S]*?\n\}/, ""));
    expect(forVersion(stage.helpers ?? "", 1)).not.toMatch(/\bcz(Decode|Encode)\b/);
  });

  it("needs Safelight 3.2.0, the first to define SL_PROCESS_VERSION", () => {
    expect(manifest.minAppVersion).toBe("3.2.0");
  });

  it("gives version 3 the version 2 path, one directive per line", () => {
    for (const src of [stage.glsl, stage.helpers ?? ""]) {
      expect(forVersion(src, 3)).toBe(forVersion(src, 2));
      for (const line of src.split("\n").filter((l) => l.trim().startsWith("#"))) {
        expect(line).toMatch(/^(#if SL_PROCESS_VERSION >= 2|#else|#endif)$/);
      }
    }
    expect(stage.glsl).toContain("#if SL_PROCESS_VERSION >= 2");
  });

  it("keeps the sign through the transfer curves, so pow never sees a negative base", () => {
    expect(helpers).toMatch(/vec3 czDecode\(vec3 y\) \{\s*vec3 a = abs\(y\);\s*return sign\(y\) \* mix\(a \/ 12\.92, pow\(\(a \+ 0\.055\) \/ 1\.055, vec3\(2\.4\)\), step\(0\.04045, a\)\);/);
    expect(helpers).toMatch(/vec3 czEncode\(vec3 x\) \{\s*vec3 a = abs\(x\);\s*return sign\(x\) \* mix\(a \* 12\.92, 1\.055 \* pow\(a, vec3\(1\.0 \/ 2\.4\)\) - 0\.055, step\(0\.0031308, a\)\);/);
  });

  it("runs darktable's process: L_tint − sourceMix / 2 + L · sourceMix / 100, the tint's a and b", () => {
    expect(inline).toMatch(/vec3 tint = czLab\(czHsl2Rgb\(hue, saturation, lightness \* 0\.01\)\);/);
    expect(inline).toMatch(/vec3 coloured = vec3\(tint\.x - sourceMix \* 0\.5 \+ lab\.x \* sourceMix \* 0\.01, tint\.y, tint\.z\);/);
  });

  it("defines the Lab and HSL helpers, each called, and calls nothing undefined", () => {
    const defined: string[] = [];
    const re = /\b(?:float|vec[234]|mat[234]|int|bool|void)\s+([a-zA-Z_]\w*)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(helpers)) !== null) defined.push(m[1]);
    expect(defined.sort()).toEqual(["czDecode", "czEncode", "czF", "czFInv", "czHsl2Rgb", "czHue2Rgb", "czLab", "czRgb"]);
    const callCount = (n: string) => (all.match(new RegExp(`\\b${n}\\s*\\(`, "g")) ?? []).length;
    for (const n of defined) expect(callCount(n)).toBeGreaterThanOrEqual(2);
    const HOST = new Set(["abs", "sign", "step", "pow", "mix", "vec3", "mat3", "if", "float"]);
    const called = new Set<string>();
    const callRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    while ((m = callRe.exec(all)) !== null) called.add(m[1]);
    expect([...called].filter((n) => !HOST.has(n) && !defined.includes(n))).toEqual([]);
  });

  it("costs no texture fetches and has no loops", () => {
    expect(all).not.toMatch(/\b(texture|readPrev|texelFetch)\s*\(/);
    expect(all).not.toMatch(/\b(for|while|do)\b/);
  });

  it("every numeric literal carries a decimal point", () => {
    expect(all.match(/(?<![\w.])\d+(?![\w.])/g) ?? []).toEqual([]);
    expect(strip(forVersion(`${stage.helpers}\n${stage.glsl}`, 1)).match(/(?<![\w.])\d+(?![\w.])/g) ?? []).toEqual([]);
  });

  it("carries the model's matrices, white point and CIE constants, formatted by glslLiteral", () => {
    const literals = [...SRGB_TO_XYZ_D50, ...XYZ_D50_TO_SRGB, ...D50_WHITE, LAB_EPSILON, LAB_KAPPA, LAB_CBRT_EPSILON].map(glslLiteral);
    for (const s of literals) {
      expect(s).toMatch(/^-?\d+\.\d+$/);
      expect(helpers.includes(s)).toBe(true);
    }
  });

  it("names no helper parameter or local after a uniform key, and uses mix only as the builtin", () => {
    for (const key of PARAM_KEYS) {
      expect(helpers).not.toMatch(new RegExp(`\\b(float|vec[234])\\s+${key}\\b`));
      expect(inline).not.toMatch(new RegExp(`\\b(float|vec[234])\\s+${key}\\b`));
    }
    expect(all).not.toMatch(/\bmix\b(?!\s*\()/);
  });
});
