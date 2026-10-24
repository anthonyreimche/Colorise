// The model against darktable: hsl2rgb / rgb2hsl (src/common/colorspaces.h),
// the Rec.709 → XYZ D50 → Lab plumbing the module feeds its colour through,
// and colorize.c's commit_params + process, each transcribed here and run
// against the model over a grid; then the opacity blend and the whole
// per-pixel path on display pixels.

import { describe, expect, it } from "vitest";
import {
  D50_WHITE,
  DEFAULT_PARAMS,
  LAB_CBRT_EPSILON,
  LAB_EPSILON,
  LAB_KAPPA,
  SRGB_TO_XYZ_D50,
  XYZ_D50_TO_SRGB,
  coloriseLab,
  colorisePixel,
  hsl2rgb,
  hue2rgb,
  labFromLinearSrgb,
  linearSrgbFromLab,
  linearToSrgb,
  rgb2hsl,
  srgbToLinear,
  tintLab,
  type Params,
  type Vec3,
} from "../src/model";

// ── darktable, transcribed ───────────────────────────────────────────────────

/** colorspaces.h hue2rgb: hue pre-scaled to 0..6. */
function dtHue2rgb(m1: number, m2: number, hue: number): number {
  if (hue < 1) return m1 + (m2 - m1) * hue;
  if (hue < 3) return m2;
  return hue < 4 ? m1 + (m2 - m1) * (4 - hue) : m1;
}

function dtHsl2rgb(h: number, s: number, l: number): Vec3 {
  if (s === 0) return [l, l, l];
  const m2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  h *= 6;
  return [dtHue2rgb(m1, m2, h < 4 ? h + 2 : h - 4), dtHue2rgb(m1, m2, h), dtHue2rgb(m1, m2, h > 2 ? h - 2 : h + 4)];
}

function dtRgb2hsl([r, g, b]: Vec3): { h: number; s: number; l: number } {
  const pmax = Math.max(r, g, b);
  const pmin = Math.min(r, g, b);
  const delta = pmax - pmin;
  let hv = 0;
  let sv = 0;
  const lv = (pmin + pmax) / 2;
  if (delta !== 0) {
    sv = lv < 0.5 ? delta / Math.max(pmax + pmin, 1.52587890625e-5) : delta / Math.max(2 - pmax - pmin, 1.52587890625e-5);
    if (pmax === r) hv = (g - b) / delta;
    else if (pmax === g) hv = 2 + (b - r) / delta;
    else if (pmax === b) hv = 4 + (r - g) / delta;
    hv /= 6;
    if (hv < 0) hv += 1;
    else if (hv > 1) hv -= 1;
  }
  return { h: hv, s: sv, l: lv };
}

/** colorspaces_inline_conversions.h: sRGB_to_xyz_transposed, applied as
 *  out[r] = Σ matrix[c][r] · in[c]; d50 = { 0.9642, 1.0, 0.8249 }. */
const DT_SRGB_TO_XYZ_TRANSPOSED = [
  [0.4360747, 0.2225045, 0.0139322],
  [0.3850649, 0.7168786, 0.0971045],
  [0.1430804, 0.0606169, 0.7141733],
];
const DT_D50 = [0.9642, 1.0, 0.8249];

function dtRec709ToXyzD50(rgb: Vec3): Vec3 {
  const m = DT_SRGB_TO_XYZ_TRANSPOSED;
  return [0, 1, 2].map((r) => m[0][r] * rgb[0] + m[1][r] * rgb[1] + m[2][r] * rgb[2]) as unknown as Vec3;
}

function dtXyzToLab(xyz: Vec3): Vec3 {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const f = xyz.map((v, i) => {
    const x = v / DT_D50[i];
    return x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), -200 * (f[2] - f[1])];
}

interface DtData {
  L: number;
  a: number;
  b: number;
  mix: number;
}

/** colorize.c commit_params (params version 2). */
function dtCommit(p: Params): DtData {
  const lab = dtXyzToLab(dtRec709ToXyzD50(dtHsl2rgb(p.hue, p.saturation, p.lightness / 100)));
  return { L: lab[0], a: lab[1], b: lab[2], mix: p.sourceMix / 100 };
}

/** colorize.c process. */
function dtProcess(inLab: Vec3, d: DtData): Vec3 {
  const Lmlmix = d.L - (d.mix * 100) / 2;
  return [Lmlmix + inLab[0] * d.mix, d.a, d.b];
}

const P = (hue: number, saturation: number, lightness: number, sourceMix: number, opacity: number): Params => ({
  hue,
  saturation,
  lightness,
  sourceMix,
  opacity,
});

const HUES = Array.from({ length: 25 }, (_, i) => i / 24);
const SATS = [0, 0.25, 0.5, 1];
const LIGHTS = [0, 0.1, 0.5, 0.9, 1];

const near = (a: Vec3, b: Vec3, tol: number) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe("darktable's constants", () => {
  it("defaults are darktable's, with the opacity at 0", () => {
    expect(DEFAULT_PARAMS).toEqual(P(0, 0.5, 50, 50, 0));
  });

  it("the matrix is sRGB_to_xyz_transposed read row-major", () => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) expect(SRGB_TO_XYZ_D50[r * 3 + c]).toBe(DT_SRGB_TO_XYZ_TRANSPOSED[c][r]);
    }
  });

  it("white point and CIE constants are darktable's d50, epsilon and kappa", () => {
    expect([...D50_WHITE]).toEqual(DT_D50);
    expect(LAB_EPSILON).toBe(216 / 24389);
    expect(LAB_KAPPA).toBe(24389 / 27);
    expect(LAB_CBRT_EPSILON).toBeCloseTo(0.20689655172413796, 15);
  });
});

describe("hue2rgb", () => {
  it("interpolates below 1, holds m2 to 3, falls to m1 by 4, holds m1 after", () => {
    expect(hue2rgb(0.2, 0.8, 0.5)).toBeCloseTo(0.5, 12);
    expect(hue2rgb(0.2, 0.8, 1)).toBe(0.8);
    expect(hue2rgb(0.2, 0.8, 2.9)).toBe(0.8);
    expect(hue2rgb(0.2, 0.8, 3.5)).toBeCloseTo(0.5, 12);
    expect(hue2rgb(0.2, 0.8, 4)).toBe(0.2);
    expect(hue2rgb(0.2, 0.8, 5.9)).toBe(0.2);
  });
});

describe("hsl2rgb", () => {
  it("matches darktable over a hue × saturation × lightness grid", () => {
    for (const h of HUES) for (const s of SATS) for (const l of LIGHTS) expect(hsl2rgb(h, s, l)).toEqual(dtHsl2rgb(h, s, l));
  });

  it("hits the primaries and secondaries at full saturation and half lightness", () => {
    expect(hsl2rgb(0, 1, 0.5)).toEqual([1, 0, 0]);
    expect(near(hsl2rgb(1 / 6, 1, 0.5), [1, 1, 0], 1e-12)).toBe(true);
    expect(near(hsl2rgb(1 / 3, 1, 0.5), [0, 1, 0], 1e-12)).toBe(true);
    expect(near(hsl2rgb(0.5, 1, 0.5), [0, 1, 1], 1e-12)).toBe(true);
    expect(near(hsl2rgb(2 / 3, 1, 0.5), [0, 0, 1], 1e-12)).toBe(true);
    expect(near(hsl2rgb(5 / 6, 1, 0.5), [1, 0, 1], 1e-12)).toBe(true);
    expect(hsl2rgb(1, 1, 0.5)).toEqual([1, 0, 0]);
  });

  it("saturation 0 is the lightness grey", () => {
    expect(hsl2rgb(0.37, 0, 0.3)).toEqual([0.3, 0.3, 0.3]);
  });
});

describe("rgb2hsl", () => {
  it("matches darktable on the grid's colours", () => {
    for (const h of HUES) {
      for (const s of SATS) {
        for (const l of LIGHTS) {
          const rgb = dtHsl2rgb(h, s, l);
          expect(rgb2hsl(rgb)).toEqual(dtRgb2hsl(rgb));
        }
      }
    }
  });

  it("inverts hsl2rgb where the hue is defined", () => {
    for (const h of HUES.slice(0, 24)) {
      for (const s of [0.25, 0.5, 1]) {
        for (const l of [0.1, 0.5, 0.9]) {
          const back = rgb2hsl(hsl2rgb(h, s, l));
          expect(back.h).toBeCloseTo(h, 10);
          expect(back.s).toBeCloseTo(s, 10);
          expect(back.l).toBeCloseTo(l, 10);
        }
      }
    }
  });

  it("gives greys hue 0 and saturation 0", () => {
    expect(rgb2hsl([0.4, 0.4, 0.4])).toEqual({ h: 0, s: 0, l: 0.4 });
  });

  it("floors the saturation divisor at darktable's 1.52587890625e-05", () => {
    expect(rgb2hsl([1e-6, 0, 0]).s).toBeCloseTo(1e-6 / 1.52587890625e-5, 12);
  });
});

describe("Lab plumbing", () => {
  it("the transfer functions are the host's", () => {
    expect(srgbToLinear(0.03)).toBe(0.03 / 12.92);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214041, 6);
    expect(linearToSrgb(0.002)).toBe(0.002 * 12.92);
    expect(linearToSrgb(1.5)).toBeCloseTo(1, 12);
    expect(linearToSrgb(-0.2)).toBe(0);
    for (let i = 0; i <= 200; i++) expect(linearToSrgb(srgbToLinear(i / 200))).toBeCloseTo(i / 200, 9);
  });

  it("white is L 100 and neutral to darktable's rounded white point, black is L 0", () => {
    const white = labFromLinearSrgb([1, 1, 1]);
    expect(white[0]).toBeCloseTo(100, 3);
    expect(Math.abs(white[1])).toBeLessThan(0.03);
    expect(Math.abs(white[2])).toBeLessThan(0.03);
    expect(labFromLinearSrgb([0, 0, 0])[0]).toBeCloseTo(0, 12);
  });

  it("sRGB 0.5 grey is L about 53.39", () => {
    const g = srgbToLinear(0.5);
    expect(labFromLinearSrgb([g, g, g])[0]).toBeCloseTo(53.39, 1);
  });

  it("axes: red is +a, blue is −b, yellow is +b", () => {
    expect(labFromLinearSrgb([1, 0, 0])[1]).toBeGreaterThan(50);
    expect(labFromLinearSrgb([0, 0, 1])[2]).toBeLessThan(-50);
    expect(labFromLinearSrgb([1, 1, 0])[2]).toBeGreaterThan(50);
  });

  it("matches darktable's XYZ → Lab on the grid", () => {
    for (const h of HUES) {
      for (const s of SATS) {
        const rgb = dtHsl2rgb(h, s, 0.5);
        expect(near(labFromLinearSrgb(rgb), dtXyzToLab(dtRec709ToXyzD50(rgb)), 1e-9)).toBe(true);
      }
    }
  });

  it("round-trips through the exact inverse matrix", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const rgb: Vec3 = [rnd(), rnd(), rnd()];
      expect(near(linearSrgbFromLab(labFromLinearSrgb(rgb)), rgb, 1e-9)).toBe(true);
    }
    expect(XYZ_D50_TO_SRGB.some((v) => String(v).replace(/^-/, "").length > 12)).toBe(true);
  });
});

describe("tintLab (commit_params)", () => {
  it("is darktable's Lab of the HSL colour over the grid", () => {
    for (const h of HUES) {
      for (const s of SATS) {
        for (const l of [0, 10, 50, 90, 100]) {
          const p = P(h, s, l, 50, 100);
          const d = dtCommit(p);
          expect(near(tintLab(p), [d.L, d.a, d.b], 1e-9)).toBe(true);
        }
      }
    }
  });
});

describe("coloriseLab (process + opacity)", () => {
  const LABS: Vec3[] = [
    [0, 0, 0],
    [12, -30, 40],
    [50, 0, 0],
    [53.39, 8, -20],
    [87, 60, 60],
    [100, 0, 0],
  ];
  const PARAMS = [
    P(0, 0.5, 50, 50, 100),
    P(0.1, 0.8, 60, 0, 100),
    P(2 / 3, 1, 50, 100, 100),
    P(0.4, 0.3, 20, 75, 100),
    P(0.9, 0, 90, 33, 100),
  ];

  it("at opacity 100 is darktable's process for every source mix", () => {
    for (const p of PARAMS) {
      const d = dtCommit(p);
      for (const lab of LABS) expect(near(coloriseLab(lab, p), dtProcess(lab, d), 1e-9)).toBe(true);
    }
  });

  it("source mix 100 keeps the image's lightness, shifted by L_tint − 50; source mix 0 flattens it", () => {
    const keep = P(0.5, 0.5, 50, 100, 100);
    const [Lt] = tintLab(keep);
    expect(coloriseLab([30, 5, 5], keep)[0]).toBeCloseTo(30 + Lt - 50, 9);
    const flat = P(0.5, 0.5, 50, 0, 100);
    expect(coloriseLab([30, 5, 5], flat)[0]).toBeCloseTo(coloriseLab([80, -5, 5], flat)[0], 12);
  });

  it("a and b are the tint's, whatever the input", () => {
    const p = P(0.25, 0.7, 40, 50, 100);
    const [, a, b] = tintLab(p);
    for (const lab of LABS) {
      const out = coloriseLab(lab, p);
      expect(out[1]).toBeCloseTo(a, 12);
      expect(out[2]).toBeCloseTo(b, 12);
    }
  });

  it("opacity 0 is the identity, opacity 50 the Lab midpoint", () => {
    for (const lab of LABS) {
      expect(coloriseLab(lab, P(0.3, 0.9, 70, 20, 0))).toEqual(lab);
      const full = coloriseLab(lab, P(0.3, 0.9, 70, 20, 100));
      const half = coloriseLab(lab, P(0.3, 0.9, 70, 20, 50));
      for (let k = 0; k < 3; k++) expect(half[k]).toBeCloseTo((lab[k] + full[k]) / 2, 12);
    }
  });
});

describe("colorisePixel (the shader's path on a display pixel)", () => {
  it("leaves every pixel unchanged at the defaults", () => {
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const c: Vec3 = [i / 20, j / 20, ((i + j) % 21) / 20];
        expect(near(colorisePixel(c, DEFAULT_PARAMS), c, 1e-9)).toBe(true);
      }
    }
  });

  it("darktable's defaults at full opacity redden a mid grey", () => {
    const out = colorisePixel([0.5, 0.5, 0.5], { ...DEFAULT_PARAMS, opacity: 100 });
    expect(out[0]).toBeGreaterThan(out[1] + 0.05);
    expect(out[0]).toBeGreaterThan(out[2] + 0.05);
  });

  it("source mix 0 gives one colour whatever the input", () => {
    const p = P(0.6, 0.6, 45, 0, 100);
    expect(near(colorisePixel([0.1, 0.2, 0.3], p), colorisePixel([0.9, 0.8, 0.7], p), 1e-9)).toBe(true);
  });

  it("clips results outside the gamut to [0, 1]", () => {
    // Pure blue at source mix 100 over a mid grey lands outside sRGB: its
    // linear blue is above 1 before the encode clips it.
    const p = P(2 / 3, 1, 50, 100, 100);
    const g = srgbToLinear(0.5);
    const lin = linearSrgbFromLab(coloriseLab(labFromLinearSrgb([g, g, g]), p));
    expect(lin[2]).toBeGreaterThan(1);
    const out = colorisePixel([0.5, 0.5, 0.5], p);
    expect(out.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(out[2]).toBeCloseTo(1, 12);
    expect(out[0]).toBeCloseTo(linearToSrgb(lin[0]), 12);
    expect(out[1]).toBeCloseTo(linearToSrgb(lin[1]), 12);
  });

  it("clips the input to [0, 1] before decoding", () => {
    const p = P(0, 0.5, 50, 50, 100);
    expect(colorisePixel([1.4, -0.2, 0.5], p)).toEqual(colorisePixel([1, 0, 0.5], p));
  });

  it("a small opacity moves a pixel a little, toward the full result", () => {
    const c: Vec3 = [0.4, 0.5, 0.6];
    const full = colorisePixel(c, P(0.1, 0.8, 50, 50, 100));
    const bit = colorisePixel(c, P(0.1, 0.8, 50, 50, 5));
    for (let k = 0; k < 3; k++) {
      expect(Math.abs(bit[k] - c[k])).toBeLessThan(Math.abs(full[k] - c[k]));
      if (Math.abs(full[k] - c[k]) > 0.02) expect(Math.sign(bit[k] - c[k])).toBe(Math.sign(full[k] - c[k]));
    }
  });
});
