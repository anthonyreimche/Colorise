// The param-bag contract the panel, the picker and the GPU stage share: the
// five keys under the stage id, darktable's defaults for anything missing or
// foreign, and the reset patch.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/model";
import { EXT_ID, PARAM_KEYS, STAGE_ID, bagPatch, qualified, readParams, resetPatch } from "../src/params";

describe("params", () => {
  it("keys are qualified by the stage id", () => {
    expect(EXT_ID).toBe("colorise");
    expect(STAGE_ID).toBe("colorise.lab");
    expect(qualified("hue")).toBe("colorise.lab.hue");
  });

  it("lists darktable's four params then the opacity", () => {
    expect([...PARAM_KEYS]).toEqual(["hue", "saturation", "lightness", "sourceMix", "opacity"]);
  });

  it("bagPatch writes exactly the five keys", () => {
    const patch = bagPatch({ hue: 0.25, saturation: 0.7, lightness: 40, sourceMix: 80, opacity: 35 });
    expect(Object.keys(patch).sort()).toEqual(PARAM_KEYS.map(qualified).sort());
    expect(patch[qualified("hue")]).toBe(0.25);
    expect(patch[qualified("opacity")]).toBe(35);
  });

  it("readParams of an empty bag gives the defaults", () => {
    expect(readParams({})).toEqual(DEFAULT_PARAMS);
  });

  it("readParams round-trips bagPatch and merges partial bags with the defaults", () => {
    const p = { hue: 0.9, saturation: 0.1, lightness: 5, sourceMix: 95, opacity: 60 };
    expect(readParams(bagPatch(p))).toEqual(p);
    expect(readParams({ [qualified("opacity")]: 20 })).toEqual({ ...DEFAULT_PARAMS, opacity: 20 });
  });

  it("falls back to the default for non-numeric, non-finite and foreign values", () => {
    const bag = {
      [qualified("hue")]: "0.3",
      [qualified("saturation")]: NaN,
      [qualified("lightness")]: null,
      [qualified("opacity")]: Infinity,
      "other.stage.hue": 0.9,
    };
    expect(readParams(bag)).toEqual(DEFAULT_PARAMS);
  });

  it("resetPatch is the defaults as a patch", () => {
    expect(resetPatch()).toEqual(bagPatch(DEFAULT_PARAMS));
  });
});
