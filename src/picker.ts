// The eyedropper: darktable's point colour picker on the hue slider. While it
// is armed it holds the canvas's pick-drag tool, so core routes a press on the
// image to it, keeps Ctrl/⌘/Space for pan and zoom, lets go on Esc or when
// another picker takes it, and stands it aside while a canvas tool (crop mode,
// a mask brush, heal) holds the canvas. A press captures the view with this
// stage's opacity at 0 (the module reads its own input, as darktable's picker
// does), averages the 5×5 patch around the pixel (the core white-balance
// eyedropper rule) as encoded sRGB and writes the patch's HSL hue and
// saturation (color_picker_apply).

import { rgb2hsl, type Vec3 } from "./model";
import { bagPatch, qualified, readParams } from "./params";
import { api } from "./runtime";
import type { CanvasPoint, PickDragTool } from "./safelight";
import { store } from "./store";

export const PATCH = 5;

export interface Uv {
  x: number;
  y: number;
}

/** A press in the canvas's pixels → UV of a `width`×`height` frame aligned
 *  1:1 with the canvas. Null off the frame or for the host's blank 1×1 frame. */
export function pointToUv(point: CanvasPoint, width: number, height: number): Uv | null {
  if (width < 2 || height < 2) return null;
  const x = point.x / width;
  const y = point.y / height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

/** The PATCH×PATCH average around (cx, cy) of an 8-bit sRGB frame, clipped to
 *  the frame, as encoded values in 0..1. */
export function patchColor(data: ArrayLike<number>, width: number, height: number, cx: number, cy: number): Vec3 | null {
  const half = PATCH >> 1;
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.max(0, cy - half); y <= Math.min(height - 1, cy + half); y++) {
    for (let x = Math.max(0, cx - half); x <= Math.min(width - 1, cx + half); x++) {
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) sum[c] += data[o + c] / 255;
      n++;
    }
  }
  return n === 0 ? null : [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** The view as the module receives it: this stage at opacity 0, for the
 *  capture only (the live view and the photo's bag are untouched). */
export function capturePreColorise(): Promise<ImageBitmap> {
  const a = api();
  const dev = a.stores.useDevelopStore.getState();
  return a.develop.captureFrame(dev.previewParams ?? dev.params, { paramBag: { [qualified("opacity")]: 0 } });
}

/** color_picker_apply: the picked colour's HSL hue and saturation, as one
 *  commit; the other params stay. Disarms the eyedropper. */
export function commitPick(rgb: Vec3): void {
  const dev = api().stores.useDevelopStore.getState();
  const { h: hue, s: saturation } = rgb2hsl(rgb);
  dev.setDynParams(bagPatch({ ...readParams(dev.paramBag), hue, saturation }));
  void dev.commitEdit("Colorise pick");
  store().getState().setPicking(false);
}

/** Checked once the capture lands: an Esc, a commit or a photo switch in the
 *  meantime must drop the pick. */
export function pickStillWanted(photoId: string | null): boolean {
  return store().getState().picking && api().stores.useDevelopStore.getState().photoId === photoId;
}

interface Patch {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

/** Read just the patch box at a press out of a captured frame; closes the
 *  bitmap. Null off the frame and for the host's 1×1 "no renderer" blank. */
function readPatch(bitmap: ImageBitmap, point: CanvasPoint): Patch | null {
  try {
    const { width: w, height: hgt } = bitmap;
    const uv = pointToUv(point, w, hgt);
    if (!uv) return null;
    const px = Math.min(w - 1, Math.floor(uv.x * w));
    const py = Math.min(hgt - 1, Math.floor(uv.y * hgt));
    const half = PATCH >> 1;
    const x0 = Math.max(0, px - half);
    const y0 = Math.max(0, py - half);
    const bw = Math.min(w - 1, px + half) - x0 + 1;
    const bh = Math.min(hgt - 1, py + half) - y0 + 1;
    const ctx = new OffscreenCanvas(bw, bh).getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, x0, y0, bw, bh, 0, 0, bw, bh);
    return { data: ctx.getImageData(0, 0, bw, bh).data, width: bw, height: bh, cx: px - x0, cy: py - y0 };
  } finally {
    bitmap.close();
  }
}

async function pickAt(point: CanvasPoint): Promise<void> {
  try {
    const photoId = api().stores.useDevelopStore.getState().photoId;
    const patch = readPatch(await capturePreColorise(), point);
    if (!patch || !pickStillWanted(photoId)) return;
    const rgb = patchColor(patch.data, patch.width, patch.height, patch.cx, patch.cy);
    if (rgb) commitPick(rgb);
  } catch (err) {
    console.warn("[colorise] pick failed:", err);
  }
}

const PICK_TOOL: PickDragTool = { onPress: (point) => void pickAt(point) };

/** Hold the canvas's pick-drag tool while the eyedropper is armed, and let go
 *  when it disarms. Returns the stop function. */
export function syncPickDrag(): () => void {
  return store().subscribe((state, prev) => {
    if (state.picking !== prev.picking) api().develop.setPickDrag(state.picking ? PICK_TOOL : null);
  });
}
