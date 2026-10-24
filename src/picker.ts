// The eyedropper: darktable's point colour picker on the hue slider. While it
// is armed, a click-through overlay over the Develop canvas takes one plain
// left click, maps it to image UV through the overlay rect (interface-scale
// aware), captures the view with this stage's opacity at 0 (the module reads
// its own input, as darktable's picker does), averages the 5×5 patch around
// the pixel (the core white-balance eyedropper rule) as encoded sRGB and
// writes the patch's HSL hue and saturation (color_picker_apply). Esc disarms;
// core's Ctrl/⌘/Space passthrough keeps pan and zoom working. The overlay
// draws nothing, and the pick stays armed, while the Crop tool, another core
// tool or a core picker owns the canvas: the core enables its own pickers only
// when no tool is active.

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { rgb2hsl, type Vec3 } from "./model";
import { bagPatch, qualified, readParams } from "./params";
import { api, h } from "./runtime";
import type { OverlayRect } from "./safelight";
import { store } from "./store";

export const PATCH = 5;

export interface ClientBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Uv {
  x: number;
  y: number;
}

/** Client point → image UV through the displayed image rect. `clientWidth /
 *  box.width` is the interface scale (the body zoom), so a zoomed UI still
 *  lands on the pixel under the pointer. Null outside the image. */
export function pointToUv(
  clientX: number,
  clientY: number,
  box: ClientBox,
  clientWidth: number,
  rect: OverlayRect | null,
): Uv | null {
  if (!rect || box.width <= 0 || box.height <= 0 || rect.w <= 0 || rect.h <= 0) return null;
  const scale = clientWidth / box.width;
  const x = ((clientX - box.left) * scale - rect.x) / rect.w;
  const y = ((clientY - box.top) * scale - rect.y) / rect.h;
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

/** Read just the patch box out of a captured frame; closes the bitmap. Null
 *  for the host's 1×1 "no renderer" blank. */
function readPatch(bitmap: ImageBitmap, uv: Uv): Patch | null {
  try {
    const { width: w, height: hgt } = bitmap;
    if (w < 2 || hgt < 2) return null;
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

async function pickAt(clientX: number, clientY: number, el: HTMLElement | null, rect: OverlayRect | null): Promise<void> {
  try {
    if (!el) return;
    const photoId = api().stores.useDevelopStore.getState().photoId;
    const uv = pointToUv(clientX, clientY, el.getBoundingClientRect(), el.clientWidth, rect);
    if (!uv) return;
    const patch = readPatch(await capturePreColorise(), uv);
    if (!patch || !pickStillWanted(photoId)) return;
    const rgb = patchColor(patch.data, patch.width, patch.height, patch.cx, patch.cy);
    if (rgb) commitPick(rgb);
  } catch (err) {
    console.warn("[colorise] pick failed:", err);
  }
}

export function PickerOverlay() {
  const { useEffect, useRef } = api().react;
  const picking = store()((s) => s.picking);
  const cropping = api().stores.useDevelopStore((s) => s.cropping);
  const activeTool = api().stores.useDevelopStore((s) => s.activeTool);
  const wbPicking = api().stores.useDevelopStore((s) => s.wbPicking);
  const hslPicking = api().stores.useDevelopStore((s) => s.hslPicking);
  const overlay = api().develop.useDevelopOverlay();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store().getState().setPicking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  if (!picking || cropping || activeTool !== "none" || wbPicking || hslPicking) return null;
  const style: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "auto",
    cursor: api().cursors.resolve("pick"),
  };
  return h("div", {
    ref,
    style,
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      void pickAt(e.clientX, e.clientY, ref.current, overlay.rect);
    },
  });
}
