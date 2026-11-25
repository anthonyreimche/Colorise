// The Colorise panel: darktable's four sliders (colorize.c gui_init) in its
// order and wording, then the blend opacity. The hue track carries darktable's
// seven stops and the saturation track runs from its 0.2 grey to the fully
// saturated hue, repainted as the hue moves (update_saturation_slider_end_color).
// A drag writes the scope live and commits on release, so one gesture is one
// undo entry. Rendered with the host's React through createElement.
//
// A Colour field sits above the hue and saturation sliders for picking the
// tint by eye or from the photo. It edits whatever useParamScope hands it: the
// photo's bag in the dock, a mask's in the Masking panel's Adjust tab.

import { hsl2rgb, linearToSrgb, rgb2hsl, type Params, type Vec3 } from "./model";
import { bagPatch, qualified, readParams } from "./params";
import { api, h } from "./runtime";
import type { Hsl, Rgb } from "./safelight";

/** darktable's hue slider stops, as display RGB. */
export const HUE_TRACK =
  "linear-gradient(to right, rgb(255,0,0) 0%, rgb(255,255,0) 16.6%, rgb(0,255,0) 32.2%, " +
  "rgb(0,255,255) 49.8%, rgb(0,0,255) 66.4%, rgb(255,0,255) 83%, rgb(255,0,0) 100%)";

const css = (rgb: Vec3): string => `rgb(${rgb.map((v) => Math.round(v * 255)).join(",")})`;

/** darktable's saturation slider: 0.2 grey to the hue at full saturation. */
export function saturationTrack(hue: number): string {
  return `linear-gradient(to right, rgb(51,51,51), ${css(hsl2rgb(hue, 1, 0.5))})`;
}

/** The tint as displayed: the model's HSL colour, read as linear Rec.709 at
 *  the panel's lightness, encoded for the swatch. */
export function tintToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const [r, g, b] = hsl2rgb(hue / 360, saturation / 100, lightness / 100);
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

/** A picked or typed colour as the model's hue and saturation (colorize.c's
 *  color_picker_apply reads the encoded colour as the HSL input). Lightness
 *  has its own slider, so the field's is left as given. */
export function hueSaturationFromRgb(rgb: Rgb): Hsl {
  const { h: hue, s: saturation } = rgb2hsl(rgb);
  return { hue: hue * 360, saturation: saturation * 100, lightness: 50 };
}

/** The view as the module receives it: this stage's opacity at 0. */
const PICK_WITHOUT_STAGE = { paramBag: { [qualified("opacity")]: 0 } };

export function ColorisePanel() {
  const { Slider } = api().components;
  const { ColourField, Stack } = api().ui;
  const scope = api().develop.useParamScope();

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
  const colour = h(ColourField, {
    label: "Colour",
    hue: Math.round(p.hue * 360),
    saturation: Math.round(p.saturation * 100),
    toRgb: (hueDeg: number, sat: number) => tintToRgb(hueDeg, sat, live().lightness),
    fromRgb: hueSaturationFromRgb,
    pick: PICK_WITHOUT_STAGE,
    title: "The tint's hue and saturation; the eyedropper takes them from the photo",
    onChange: ({ hue: hueDeg, saturation: sat }) =>
      apply({ ...live(), hue: hueDeg / 360, ...(sat === undefined ? {} : { saturation: sat / 100 }) }),
    onCommit: () => commit("hue"),
  });

  return h(
    Stack,
    { gap: 2, style: { padding: 8 } },
    colour,
    hue,
    slider("Saturation", Math.round(p.saturation * 100), 100, 50, (q, v) => ({ ...q, saturation: v / 100 }), saturationTrack(p.hue)),
    slider("Lightness", p.lightness, 100, 50, (q, v) => ({ ...q, lightness: v })),
    slider("Source mix", p.sourceMix, 100, 50, (q, v) => ({ ...q, sourceMix: v })),
    slider("Opacity", p.opacity, 100, 0, (q, v) => ({ ...q, opacity: v })),
  );
}
