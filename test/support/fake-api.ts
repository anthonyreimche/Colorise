// A stand-in Safelight API over real React and zustand: the develop store
// holds a param bag, commits and registrations are recorded, the colour field
// records its props, and the slider and ui kit are plain DOM so Testing Library
// can find controls by their labels.

import * as React from "react";
import { create } from "zustand";
import type {
  ButtonProps,
  ColourFieldProps,
  DevelopParams,
  DevelopStoreState,
  PanelContribution,
  ParamScope,
  ProcessingStageContribution,
  RowProps,
  SafelightAPI,
  SliderProps,
  StackProps,
  StateCreator,
  StoreApi,
  UiKit,
} from "../../src/safelight";

const e = React.createElement;

/** A range input under the slider's label; the wrapper carries the track
 *  background so a test can read the gradient. Pointer-up commits. */
const Slider = ({ label, value, min, max, step, onChange, onCommit, trackBackground }: SliderProps) =>
  e(
    "div",
    { "data-slider": label, "data-track": trackBackground ?? "" },
    e("input", {
      type: "range",
      "aria-label": label,
      value,
      min,
      max,
      step,
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) => onChange(Number(ev.target.value)),
      onPointerUp: () => onCommit?.(),
    }),
  );

/** The colour fields rendered, by label: the props of the latest render, so a
 *  test reads hue/saturation/pick and calls onChange/onCommit as the field would. */
const fields = new Map<string, ColourFieldProps>();

const ColourField = (props: ColourFieldProps) => {
  fields.set(props.label, props);
  return e("div", {
    "data-colour-field": props.label,
    "data-hue": props.hue,
    "data-saturation": props.saturation,
    "data-lightness": props.lightness,
  });
};

const ui: UiKit = {
  Button: ({ children, onClick, disabled, title, "aria-label": ariaLabel, "aria-pressed": ariaPressed }: ButtonProps) =>
    e("button", { type: "button", onClick, disabled, title, "aria-label": ariaLabel, "aria-pressed": ariaPressed }, children),
  Row: ({ children }: RowProps) => e("div", null, children),
  Stack: ({ children }: StackProps) => e("div", null, children),
  ColourField,
  tokens: {
    surface0: "#525252",
    border: "#3b3b3b",
    textMuted: "#9c9c9c",
  },
};

// The core's develop params are opaque to the extension; any object stands in.
const PARAMS = {} as DevelopParams;

export interface Rig {
  api: SafelightAPI;
  develop: StoreApi<DevelopStoreState>;
  commits: string[];
  stages: ProcessingStageContribution[];
  panels: PanelContribution[];
  unregisteredStages: string[];
  /** The latest props of each ColourField rendered, by label. */
  fields: Map<string, ColourFieldProps>;
  /** Puts what renders from here on inside a mask holding `bag`, as the core's
   *  Masking panel does; returns the mask's store. */
  inMask(bag?: Record<string, unknown>): StoreApi<{ bag: Record<string, unknown> }>;
}

export function fakeApi(bag: Record<string, unknown> = {}): Rig {
  const commits: string[] = [];
  const stages: ProcessingStageContribution[] = [];
  const panels: PanelContribution[] = [];
  const unregisteredStages: string[] = [];
  fields.clear();
  let mask: StoreApi<{ bag: Record<string, unknown> }> | null = null;
  const develop: StoreApi<DevelopStoreState> = create<DevelopStoreState>()((set) => ({
    photoId: "p1",
    params: PARAMS,
    previewParams: null,
    paramBag: bag,
    setDynParams: (patch) => set((s) => ({ paramBag: { ...s.paramBag, ...patch } })),
    commitEdit: async (label) => {
      commits.push(label);
    },
  }));
  const photoScope: ParamScope = {
    maskId: null,
    getParam: (key) => develop.getState().paramBag[key],
    getParams: () => develop.getState().paramBag,
    setParams: (patch) => develop.getState().setDynParams(patch),
    commit: (label) => void develop.getState().commitEdit(label),
  };
  const maskScope = (store: StoreApi<{ bag: Record<string, unknown> }>): ParamScope => ({
    maskId: "mask-1",
    getParam: (key) => store.getState().bag[key],
    getParams: () => store.getState().bag,
    setParams: (patch) => store.setState((s) => ({ bag: { ...s.bag, ...patch } })),
    commit: (label) => void commits.push(`mask: ${label}`),
  });
  const api: SafelightAPI = {
    version: 1,
    extensionId: "colorise",
    react: React,
    registerProcessingStage: (c) => void stages.push(c),
    unregisterProcessingStage: (id) => void unregisteredStages.push(id),
    registerPanel: (c) => void panels.push(c),
    components: { Slider },
    ui,
    stores: {
      create: <T,>(init: StateCreator<T>) => create<T>()(init),
      useDevelopStore: develop,
    },
    develop: {
      // Subscribed, as the core's scopes are, so a write re-renders. A rig is
      // inside a mask or not for every render it makes, so the hook called is too.
      useParamScope: () => {
        if (mask) {
          mask((s) => s.bag);
          return maskScope(mask);
        }
        develop((s) => s.paramBag);
        return photoScope;
      },
    },
  };
  const inMask = (bag: Record<string, unknown> = {}) => {
    mask = create<{ bag: Record<string, unknown> }>()(() => ({ bag }));
    return mask;
  };
  return { api, develop, commits, stages, panels, unregisteredStages, fields, inMask };
}
