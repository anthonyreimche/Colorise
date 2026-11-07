// The Colorise panel: darktable's four sliders (colorize.c gui_init) in its
// order and wording, then the blend opacity. The hue track carries darktable's
// seven stops and the saturation track runs from its 0.2 grey to the fully
// saturated hue, repainted as the hue moves (update_saturation_slider_end_color).
// A drag writes the scope live and commits on release, so one gesture is one
// undo entry. Rendered with the host's React through createElement.
//
// It edits whatever useParamScope hands it: the photo's bag in the dock, a
// mask's in the Masking panel's Adjust tab. The eyedropper samples the photo
// for the photo's own tint, so it shows only in the dock.

import { hsl2rgb, type Params, type Vec3 } from "./model";
import { bagPatch, readParams } from "./params";
import { api, h } from "./runtime";
import { store } from "./store";

/** darktable's hue slider stops, as display RGB. */
export const HUE_TRACK =
  "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.6%, rgb(0,255,0) 32.2%, " +
  "rgb(0,255,255) 49.8%, rgb(0,0,255) 66.4%, rgb(255,0,255) 83%, rgb(255,0,0) 100%)";

const css = (rgb: Vec3): string => `rgb(${rgb.map((v) => Math.round(v * 255)).join(",")})`;

/** darktable's saturation slider: 0.2 grey to the hue at full saturation. */
export function saturationTrack(hue: number): string {
  return `linear-gradient(to right, rgb(51,51,51), ${css(hsl2rgb(hue, 1, 0.5))})`;
}

const PICK_LABEL = "Pick hue from the image";

export function ColorisePanel() {
  const { Slider } = api().components;
  const { Button, Row, Stack } = api().ui;
  const { useEffect } = api().react;
  const scope = api().develop.useParamScope();
  const inMask = scope.maskId !== null;
  const picking = store()((s) => s.picking);
  const holdsPickDrag = api().develop.usePickDragHeld();

  // Core lets go of the tool on Escape or when another picker takes it.
  useEffect(() => {
    if (!inMask && picking && !holdsPickDrag) store().getState().setPicking(false);
  }, [inMask, picking, holdsPickDrag]);

  const p = readParams(scope.getParams());
  // Drags outrun React's renders, so each change starts from the bag the
  // scope holds now rather than this render's snapshot.
  const live = (): Params => readParams(scope.getParams());
  const apply = (next: Params) => scope.setParams(bagPatch(next));
  const commit = (what: string) => scope.commit(`Colorise ${what}`);

  const slider = (
    label: string,
    value: number,
    max: number,
    defaultValue: number,
    update: (current: Params, v: number) => Params,
    trackBackground?: string,
  ) =>
    h(Slider, {
      key: label,
      label,
      value,
      min: 0,
      max,
      step: 1,
      defaultValue,
      trackBackground,
      onChange: (v: number) => apply(update(live(), v)),
      onCommit: () => commit(label.toLowerCase()),
    });

  const hue = slider("Hue", Math.round(p.hue * 360), 360, 0, (q, v) => ({ ...q, hue: v / 360 }), HUE_TRACK);
  const pick = inMask
    ? null
    : h(
        Button,
        {
          size: "sm",
          active: picking,
          "aria-pressed": picking,
          title: "Pick the hue and saturation from the image (Esc cancels)",
          "aria-label": PICK_LABEL,
          onClick: () => store().getState().setPicking(!picking),
        },
        "Pick",
      );

  return h(
    Stack,
    { gap: 2, style: { padding: 8 } },
    h(Row, { gap: 4, align: "center" }, h("div", { style: { flex: "1 1 auto", minWidth: 0 } }, hue), pick),
    slider("Saturation", Math.round(p.saturation * 100), 100, 50, (q, v) => ({ ...q, saturation: v / 100 }), saturationTrack(p.hue)),
    slider("Lightness", p.lightness, 100, 50, (q, v) => ({ ...q, lightness: v })),
    slider("Source mix", p.sourceMix, 100, 50, (q, v) => ({ ...q, sourceMix: v })),
    slider("Opacity", p.opacity, 100, 0, (q, v) => ({ ...q, opacity: v })),
  );
}
