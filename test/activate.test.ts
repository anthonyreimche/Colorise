// What activate() registers under the extension id, the dock header's reset,
// and deactivate() tearing it all down.

import { afterEach, describe, expect, it, vi } from "vitest";
import { activate, deactivate } from "../src/index";
import { DEFAULT_PARAMS } from "../src/model";
import { ColorisePanel } from "../src/Panel";
import { PARAM_KEYS, STAGE_ID, qualified, readParams } from "../src/params";
import { store } from "../src/store";
import { fakeApi, fakeBitmap } from "./support/fake-api";

describe("activate", () => {
  afterEach(() => deactivate());

  it("registers the stage and the panel", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.stages.map((s) => s.id)).toEqual([STAGE_ID]);
    expect(rig.panels).toHaveLength(1);
    expect(rig.panels[0]).toMatchObject({
      id: "colorise.panel",
      title: "Colorise",
      component: ColorisePanel,
      defaultDock: { module: "develop", direction: "right", order: 7, width: 268 },
    });
  });

  it("holds core's pick-drag tool while the eyedropper is armed and lets it go when off", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.pickDrag.getState().held).toBeNull();
    store().getState().setPicking(true);
    expect(rig.pickDrag.getState().held).not.toBeNull();
    store().getState().setPicking(false);
    expect(rig.pickDrag.getState().held).toBeNull();
  });

  it("captures the view without Colorise on a press", () => {
    const rig = fakeApi({}, () => Promise.resolve(fakeBitmap(1, 1)));
    activate(rig.api);
    store().getState().setPicking(true);
    rig.pickDrag.getState().held?.onPress?.({ x: 1, y: 1 });
    expect(rig.captures).toEqual([{ [qualified("opacity")]: 0 }]);
  });

  it("offers the panel in masks, owning exactly the keys the stage's mask copy reads", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.panels[0].mask?.component).toBe(ColorisePanel);
    const owns = [...(rig.panels[0].mask?.owns ?? [])].sort();
    expect(owns).toEqual(PARAM_KEYS.map(qualified).sort());
    expect(owns).toEqual(rig.stages[0].uniforms.map((u) => `${STAGE_ID}.${u.key}`).sort());
  });

  it("resets every key from the dock header in one commit", () => {
    const rig = fakeApi({ [qualified("hue")]: 0.7, [qualified("opacity")]: 55 });
    activate(rig.api);
    rig.panels[0].onReset?.();
    expect(readParams(rig.develop.getState().paramBag)).toEqual(DEFAULT_PARAMS);
    expect(rig.commits).toEqual(["Colorise reset"]);
  });

  it("disarms the picker, lets the pick-drag go and drops the stage on deactivate", () => {
    const rig = fakeApi();
    activate(rig.api);
    store().getState().setPicking(true);
    deactivate();
    expect(store().getState().picking).toBe(false);
    expect(rig.unregisteredStages).toEqual([STAGE_ID]);
    expect(rig.pickDrag.getState().held).toBeNull();
  });
});

describe("deactivate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does nothing and throws nothing when activate() never ran", async () => {
    vi.resetModules();
    const fresh = await import("../src/index");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => fresh.deactivate()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns, rather than throws, when a teardown call fails", () => {
    const rig = fakeApi();
    rig.api.unregisterProcessingStage = () => {
      throw new Error("host gone");
    };
    activate(rig.api);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => deactivate()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[colorise] deactivate failed:", expect.any(Error));
  });
});
