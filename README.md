# Colorise for Safelight

A [Safelight](https://github.com/anthonyreimche/SafeLight) extension that ports
[**darktable**](https://www.darktable.org/)'s *colorize* module: lay one solid
colour over the photo in Lab, keep as much of the photo's own lightness as you
like, and blend the result in at any opacity. Sepia, cyanotype, a duotone
field, a colour wash over a black-and-white conversion: this is darktable's tool
for it, with the same sliders, the same colour maths and the same eyedropper.

## What it does

darktable builds one Lab colour from **Hue**, **Saturation** and **Lightness**
(an HSL triple taken as linear Rec.709 and converted to D50 Lab), then writes
every pixel with that colour's a and b, and a lightness of

```
L' = L_colour − 50 · mix + L_photo · mix        (mix = Source mix / 100)
```

At **Source mix** 0 the photo becomes a flat colour field; at 100 it keeps its
own lightness, shifted by `L_colour − 50`. **Opacity** is darktable's blend
opacity: the module's result is mixed over the photo per Lab channel, so 0 is
the untouched photo and 100 is the module at full strength.

### The panel

- **Hue** 0–360°, over darktable's rainbow track, with an eyedropper beside it:
  arm it, click the photo, and Hue and Saturation take the clicked colour (the
  5×5 pixel average, read before this module's own tint). Esc cancels.
- **Saturation** 0–100 %, over a track that runs from darktable's grey to the
  current hue and repaints as Hue moves.
- **Lightness** 0–100 %.
- **Source mix** 0–100 %.
- **Opacity** 0–100 %, default 0: an untouched photo renders bit for bit
  unchanged, and the dock header's *Reset to defaults* gives it back.
- **In masks:** add Colorise to a mask from the Masking panel's Adjust tab to
  tint inside that mask only. The mask gets the five sliders with its own
  values; the eyedropper, which samples the whole photo, stays in the dock.
  Masks need the current processing: on a photo edited in an earlier Safelight,
  use Update processing first.

## The math

Faithful to darktable's `colorize` module (`src/iop/colorize.c`, params
version 2) and the colour functions it calls (`hsl2rgb`, `rgb2hsl`,
`dt_Rec709_to_XYZ_D50`, `dt_XYZ_to_Lab`): the HSL conversion with its hue
pre-scaled to 0–6, the Bradford-adapted sRGB → XYZ D50 matrix, darktable's
rounded D50 white, the CIE constants, and `process`'s
`L − (mix · 100) / 2 + L_in · mix`. The one addition is the opacity, which is
darktable's normal Lab blend: `out = in · (1 − opacity) + module · opacity` per
channel.

### How it maps onto Safelight

darktable applies this in the Lab section of its pipeline, on the
display-referred image. Safelight's equivalent is its display-adjust phase: the
stage runs on the display-encoded colour after the tone pipeline and before
vignette and grain, and after the Colour Correction port when that is installed
(darktable's pipe order). Per pixel it decodes with the host's transfer
function, converts to D50 Lab, applies the formula, and encodes back, which
clips anything the tint pushed out of gamut, as darktable's output stage would.
The tint's Lab is computed from the sliders inside the shader, so the saved
edit holds darktable's own four parameters plus the opacity, and a preset that
carries only some of them still renders right. At Opacity 0 the stage's branch
is never taken. There is no pre-pass; the cost is a few dozen instructions per
pixel.

Differences from darktable to be aware of:

- darktable feeds the module the Lab of its input profile; Safelight converts
  from its display sRGB. Neutrals match exactly; the lightness darktable's
  `source mix` keeps is Safelight's display lightness.
- No blend modes beyond opacity. Masks come from Safelight's Masking panel
  rather than darktable's drawn and parametric masks on the module.

### Tests

`npm test` runs on the CPU: the model against a transcription of darktable's
functions (`hsl2rgb` / `rgb2hsl` over a hue × saturation × lightness grid, the
Lab plumbing, `commit_params` and `process`), the opacity blend, the whole
per-pixel path on display pixels, the param-bag contract, the GPU stage's
contract (phase, space, the five uniforms and their defaults, the opacity gate,
zero texture fetches, decimal-point literals, constants formatted from the
model), the panel in a DOM (sliders, display scales, commits, the two coloured
tracks, the eyedropper, masks), the eyedropper's geometry and pick, and the
registration.

`npm run test:gpu` runs the stage through a Safelight checkout's WebGL harness
(headless Chromium on SwiftShader): the shader compiles inside the develop
program, an untouched photo is a bit-exact no-op (values outside [0, 1] on
process version 2 included), darktable's defaults and stronger edits at several
source mixes and opacities render to within half-float capture precision of
the model, and a mask's tint lands inside the mask while every pixel outside it
stays bit for bit as the photo's own tint left it. It needs the Safelight
repository beside this one (or `SAFELIGHT_CORE=<path>`) with its dev
dependencies installed.

## Install

Install from the Safelight **Extensions** window, or load this folder via
Developer Tools ▸ Extensions during development. A **Colorise** panel appears
in Develop (right dock). Build from source with `npm install && npm run build`
(outputs `dist/index.js`). Needs Safelight 3.1.0 or newer.

## License & credits

**GPL-3.0-or-later.** The algorithm and UI are a reimplementation of
darktable's colorize module, which is GPL-3.0; this extension is licensed under
the GPL to respect that. darktable is © its authors — see
[darktable-org/darktable](https://github.com/darktable-org/darktable). This is
an independent port and is not affiliated with or endorsed by the darktable
project.
