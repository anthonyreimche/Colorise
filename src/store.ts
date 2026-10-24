// Session state the panel and the eyedropper share: whether the eyedropper is
// armed. Not part of the edit. Built on the host's zustand `create` so the
// components subscribe like core's.

import { api } from "./runtime";
import type { StoreApi } from "./safelight";

export interface ColoriseUiState {
  picking: boolean;
  setPicking(picking: boolean): void;
}

let current: StoreApi<ColoriseUiState> | null = null;

export function initStore(): void {
  current = api().stores.create<ColoriseUiState>((set) => ({
    picking: false,
    setPicking: (picking) => set({ picking }),
  }));
}

export function store(): StoreApi<ColoriseUiState> {
  if (!current) throw new Error("[colorise] store() called before activate()");
  return current;
}
