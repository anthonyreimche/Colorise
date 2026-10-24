// The param-bag contract. The five params live in the develop store's bag
// under the stage's qualified keys; they are the GPU uniforms directly, so
// nothing is derived. Missing or foreign values read as the defaults.

import { DEFAULT_PARAMS, type Params } from "./model";

export const EXT_ID = "colorise";
export const STAGE_ID = `${EXT_ID}.lab`;

export type ParamKey = keyof Params;
/** darktable's struct order, then Safelight's opacity. */
export const PARAM_KEYS: readonly ParamKey[] = ["hue", "saturation", "lightness", "sourceMix", "opacity"];

export const qualified = (key: ParamKey): string => `${STAGE_ID}.${key}`;

export function bagPatch(p: Params): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of PARAM_KEYS) out[qualified(key)] = p[key];
  return out;
}

/** `bag` is the host's untyped per-photo bag (any extension writes to it). */
export function readParams(bag: Readonly<Record<string, unknown>>): Params {
  const out: Params = { ...DEFAULT_PARAMS };
  for (const key of PARAM_KEYS) {
    const v = bag[qualified(key)];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

export const resetPatch = (): Record<string, number> => bagPatch(DEFAULT_PARAMS);
