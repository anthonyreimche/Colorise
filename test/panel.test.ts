// @vitest-environment jsdom
// The Colorise panel in a DOM: darktable's four sliders then Opacity, on their
// display scales; a drag writes the bag live and commits once on release; the
// hue track carries darktable's seven stops and the saturation track ends at
// the hue; the eyedropper arms and disarms; inside a mask the panel edits the
// mask's bag and offers no eyedropper.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { HUE_TRACK, ColorisePanel, saturationTrack } from "../src/Panel";
import { qualified, readParams } from "../src/params";
import { initRuntime } from "../src/runtime";
import { initStore, store } from "../src/store";
import { fakeApi, type Rig } from "./support/fake-api";

afterEach(cleanup);

let rig: Rig;

function mount(bag: Record<string, unknown> = {}) {
  rig = fakeApi(bag);
  initRuntime(rig.api);
  initStore();
  render(React.createElement(ColorisePanel));
}

const params = () => readParams(rig.develop.getState().paramBag);
const slider = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const track = (label: string) => slider(label).closest("[data-slider]")?.getAttribute("data-track");

describe("ColorisePanel", () => {
  it("lays out darktable's sliders in its order, then Opacity, on display scales", () => {
    mount();
    const labels = screen.getAllByRole("slider").map((el) => el.getAttribute("aria-label"));
    expect(labels).toEqual(["Hue", "Saturation", "Lightness", "Source mix", "Opacity"]);
    expect(slider("Hue")).toMatchObject({ min: "0", max: "360", value: "0" });
    expect(slider("Saturation")).toMatchObject({ min: "0", max: "100", value: "50" });
    expect(slider("Lightness")).toMatchObject({ min: "0", max: "100", value: "50" });
    expect(slider("Source mix")).toMatchObject({ min: "0", max: "100", value: "50" });
    expect(slider("Opacity")).toMatchObject({ min: "0", max: "100", value: "0" });
  });

  it("shows the stored values on their display scales", () => {
    mount({ [qualified("hue")]: 1 / 3, [qualified("saturation")]: 0.75, [qualified("opacity")]: 40 });
    expect(slider("Hue").value).toBe("120");
    expect(slider("Saturation").value).toBe("75");
    expect(slider("Opacity").value).toBe("40");
  });

  it("writes the hue in turns live and commits once on release", () => {
    mount();
    fireEvent.change(slider("Hue"), { target: { value: "120" } });
    expect(params().hue).toBeCloseTo(1 / 3, 12);
    expect(rig.commits).toEqual([]);
    fireEvent.pointerUp(slider("Hue"));
    expect(rig.commits).toEqual(["Colorise hue"]);
  });

  it("writes saturation as a fraction and the percent sliders as they read", () => {
    mount();
    fireEvent.change(slider("Saturation"), { target: { value: "75" } });
    fireEvent.pointerUp(slider("Saturation"));
    fireEvent.change(slider("Lightness"), { target: { value: "30" } });
    fireEvent.pointerUp(slider("Lightness"));
    fireEvent.change(slider("Source mix"), { target: { value: "10" } });
    fireEvent.pointerUp(slider("Source mix"));
    fireEvent.change(slider("Opacity"), { target: { value: "40" } });
    fireEvent.pointerUp(slider("Opacity"));
    expect(params()).toEqual({ hue: 0, saturation: 0.75, lightness: 30, sourceMix: 10, opacity: 40 });
    expect(rig.commits).toEqual(["Colorise saturation", "Colorise lightness", "Colorise source mix", "Colorise opacity"]);
  });

  it("keeps the other values when one slider moves", () => {
    mount({ [qualified("hue")]: 0.5, [qualified("opacity")]: 70 });
    fireEvent.change(slider("Lightness"), { target: { value: "20" } });
    expect(params()).toEqual({ hue: 0.5, saturation: 0.5, lightness: 20, sourceMix: 50, opacity: 70 });
  });

  it("paints the hue track with darktable's seven stops", () => {
    mount();
    expect(track("Hue")).toBe(HUE_TRACK);
    for (const stop of [
      "rgb(255,0,0) 0%",
      "rgb(255,255,0) 16.6%",
      "rgb(0,255,0) 32.2%",
      "rgb(0,255,255) 49.8%",
      "rgb(0,0,255) 66.4%",
      "rgb(255,0,255) 83%",
      "rgb(255,0,0) 100%",
    ]) {
      expect(HUE_TRACK).toContain(stop);
    }
  });

  it("paints the saturation track from darktable's grey to the hue, following the hue", () => {
    mount({ [qualified("hue")]: 1 / 3 });
    expect(track("Saturation")).toBe(saturationTrack(1 / 3));
    expect(saturationTrack(1 / 3)).toBe("linear-gradient(to right, rgb(51,51,51), rgb(0,255,0))");
    fireEvent.change(slider("Hue"), { target: { value: "240" } });
    expect(track("Saturation")).toBe("linear-gradient(to right, rgb(51,51,51), rgb(0,0,255))");
  });

  it("arms the eyedropper, reports it, and disarms on a second click", () => {
    mount();
    const pick = screen.getByLabelText("Pick hue from the image");
    expect(pick.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pick);
    expect(store().getState().picking).toBe(true);
    expect(pick.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pick);
    expect(store().getState().picking).toBe(false);
    expect(pick.getAttribute("aria-pressed")).toBe("false");
  });
});

// The same panel edits a mask in the Masking panel's Adjust tab. The eyedropper
// samples the whole photo for the photo's own tint, so it isn't there.
describe("ColorisePanel in a mask", () => {
  function mountInMask(maskBag: Record<string, unknown> = {}, photoBag: Record<string, unknown> = {}) {
    rig = fakeApi(photoBag);
    const mask = rig.inMask(maskBag);
    initRuntime(rig.api);
    initStore();
    render(React.createElement(ColorisePanel));
    return mask;
  }

  it("shows the mask's values, not the photo's", () => {
    mountInMask({ [qualified("opacity")]: 30 }, { [qualified("opacity")]: 80 });
    expect(slider("Opacity").value).toBe("30");
  });

  it("writes to the mask, leaves the photo's bag alone, and commits once", () => {
    const mask = mountInMask();
    fireEvent.change(slider("Opacity"), { target: { value: "40" } });
    fireEvent.pointerUp(slider("Opacity"));
    expect(readParams(mask.getState().bag).opacity).toBe(40);
    expect(rig.develop.getState().paramBag).toEqual({});
    expect(rig.commits).toEqual(["mask: Colorise opacity"]);
  });

  it("offers no eyedropper", () => {
    mountInMask();
    expect(screen.queryByLabelText("Pick hue from the image")).toBeNull();
    expect(screen.getAllByRole("slider")).toHaveLength(5);
  });
});
