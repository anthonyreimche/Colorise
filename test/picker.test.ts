// The eyedropper's testable parts: a press in the canvas's pixels mapped to
// UV of the captured frame, the 5×5 patch averaged as encoded
// sRGB, the capture taken with this stage's opacity at 0, and a pick written
// to the bag as darktable's color_picker_apply does (hue and saturation from
// rgb2hsl) in one commit that disarms the picker.

import { beforeEach, describe, expect, it } from "vitest";
import { hsl2rgb } from "../src/model";
import { qualified, readParams } from "../src/params";
import { capturePreColorise, commitPick, patchColor, pickStillWanted, pointToUv } from "../src/picker";
import { initRuntime } from "../src/runtime";
import { initStore, store } from "../src/store";
import { fakeApi, type Rig } from "./support/fake-api";

function frame(w: number, h: number, at: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set([...at(x, y), 255], (y * w + x) * 4);
  }
  return data;
}

describe("pointToUv", () => {
  it("maps a press in the canvas's pixels to 0..1 of the frame", () => {
    expect(pointToUv({ x: 200, y: 50 }, 400, 200)).toEqual({ x: 0.5, y: 0.25 });
  });

  it("returns null off the frame or for the host's blank 1×1 frame", () => {
    expect(pointToUv({ x: -1, y: 50 }, 400, 200)).toBeNull();
    expect(pointToUv({ x: 200, y: 201 }, 400, 200)).toBeNull();
    expect(pointToUv({ x: 0, y: 0 }, 1, 1)).toBeNull();
  });
});

describe("patchColor", () => {
  it("averages the 5×5 box as encoded sRGB", () => {
    const uniform = patchColor(frame(9, 9, () => [51, 102, 204]), 9, 9, 4, 4);
    expect(uniform?.[0]).toBeCloseTo(0.2, 12);
    expect(uniform?.[1]).toBeCloseTo(0.4, 12);
    expect(uniform?.[2]).toBeCloseTo(0.8, 12);
    const split = frame(9, 9, (x) => (x < 4 ? [0, 0, 0] : [188, 188, 188]));
    expect(patchColor(split, 9, 9, 4, 4)?.[0]).toBeCloseTo((3 * 188) / 255 / 5, 12);
  });

  it("clips the box at the frame edge", () => {
    const corner = frame(9, 9, (x, y) => (x === 0 && y === 0 ? [255, 255, 255] : [0, 0, 0]));
    expect(patchColor(corner, 9, 9, 0, 0)?.[0]).toBeCloseTo(1 / 9, 12);
  });
});

describe("the pick", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = fakeApi({ [qualified("opacity")]: 60, [qualified("lightness")]: 30 });
    initRuntime(rig.api);
    initStore();
  });

  it("captures the view with this stage's opacity at 0", () => {
    void capturePreColorise();
    expect(rig.captures).toEqual([{ [qualified("opacity")]: 0 }]);
  });

  it("writes the picked colour's hue and saturation, keeps the rest, commits once and disarms", () => {
    store().getState().setPicking(true);
    commitPick(hsl2rgb(0.25, 0.6, 0.4));
    const p = readParams(rig.develop.getState().paramBag);
    expect(p.hue).toBeCloseTo(0.25, 10);
    expect(p.saturation).toBeCloseTo(0.6, 10);
    expect(p.lightness).toBe(30);
    expect(p.opacity).toBe(60);
    expect(rig.commits).toEqual(["Colorise pick"]);
    expect(store().getState().picking).toBe(false);
  });

  it("a grey pick gives hue 0 and saturation 0", () => {
    commitPick([0.5, 0.5, 0.5]);
    const p = readParams(rig.develop.getState().paramBag);
    expect(p.hue).toBe(0);
    expect(p.saturation).toBe(0);
  });

  it("is still wanted only while armed and on the same photo", () => {
    store().getState().setPicking(true);
    expect(pickStillWanted("p1")).toBe(true);
    expect(pickStillWanted("p0")).toBe(false);
    store().getState().setPicking(false);
    expect(pickStillWanted("p1")).toBe(false);
  });
});
