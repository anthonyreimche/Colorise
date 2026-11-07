// Colorise, a Safelight extension (GPL-3.0-or-later).
//
// A port of darktable's colorize module: a solid colour laid over the photo in
// Lab, with the photo's own lightness mixed back in, at any opacity. Registers
// the display-adjust stage (stage.ts) and the Develop panel (Panel.ts), and
// holds core's pick-drag tool while the eyedropper is armed (picker.ts).

import { ColorisePanel } from "./Panel";
import { EXT_ID, PARAM_KEYS, STAGE_ID, qualified, resetPatch } from "./params";
import { syncPickDrag } from "./picker";
import { api, initRuntime } from "./runtime";
import type { SafelightAPI } from "./safelight";
import { coloriseStage } from "./stage";
import { initStore, store } from "./store";

const PANEL_ID = `${EXT_ID}.panel`;

// Null until activate() runs.
let activeHost: SafelightAPI | null = null;
let unsyncPickDrag: (() => void) | null = null;

function reset(): void {
  const dev = api().stores.useDevelopStore.getState();
  dev.setDynParams(resetPatch());
  void dev.commitEdit("Colorise reset");
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  initStore();
  activeHost = host;
  // At opacity 0 the stage's branch is never taken, so an untouched photo
  // renders bit-for-bit unchanged.
  host.registerProcessingStage(coloriseStage());
  host.registerPanel({
    id: PANEL_ID,
    title: "Colorise",
    component: ColorisePanel,
    defaultDock: { module: "develop", direction: "right", order: 7, width: 268 },
    onReset: reset,
    // The same panel edits a mask's tint in the Masking panel's Adjust tab.
    mask: { component: ColorisePanel, owns: PARAM_KEYS.map(qualified) },
  });
  unsyncPickDrag = syncPickDrag();
}

export function deactivate(): void {
  // activate() never ran, or deactivate() already ran: nothing to tear down.
  const host = activeHost;
  if (!host) return;
  activeHost = null;
  // The explicit unregisters run before the host sweeps this extension's
  // registrations on disable or uninstall, which keeps a re-enable clean. A
  // throw here would skip that sweep, so a failure is logged instead.
  try {
    store().getState().setPicking(false);
    unsyncPickDrag?.();
    unsyncPickDrag = null;
    host.develop.setPickDrag(null);
    host.unregisterProcessingStage(STAGE_ID);
  } catch (err) {
    console.warn("[colorise] deactivate failed:", err);
  }
}
