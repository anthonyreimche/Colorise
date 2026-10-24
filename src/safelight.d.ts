// The slice of Safelight's extension API this extension touches, mirrored from
// the app's src/extensions/types.ts, src/extensions/ui-kit.tsx,
// src/ui/components/Slider.tsx and src/state/develop-store.ts. Extensions are
// standalone bundles, so the host's source is not on the type path; React types
// come from @types/react (dev only).

import type { ComponentType, CSSProperties, ReactNode } from "react";

export interface StoreApi<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState(): T;
  setState(partial: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((s: T) => Partial<T>)) => void,
  get: () => T,
) => T;

/** Core develop params: opaque here, only ever handed back to core. */
export type DevelopParams = Record<string, unknown> & { readonly __develop: unique symbol };

export interface DevelopStoreState {
  photoId: string | null;
  params: DevelopParams;
  previewParams: DevelopParams | null;
  /** Extension stage params by qualified key. Values are whatever the owning
   *  stage wrote and come back from sidecar JSON: a runtime boundary. */
  paramBag: Record<string, unknown>;
  /** The Crop tool is open; the view then draws a widened crop. */
  cropping: boolean;
  /** The core canvas tool in use (ToolMode); "none" when no tool owns the canvas. */
  activeTool: "none" | "mask" | "retouch" | "hsl-picker";
  /** The white-balance eyedropper is armed: its next click takes the canvas. */
  wbPicking: boolean;
  /** The HSL colour picker is armed: its click and drag take the canvas. */
  hslPicking: boolean;
  setDynParams(patch: Record<string, unknown>): void;
  commitEdit(label: string): Promise<void>;
}

export interface OverlayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DevelopOverlayState {
  rect: OverlayRect | null;
  nonce: number;
}

export type GlslType = "float" | "int" | "bool" | "vec2" | "vec3" | "vec4" | "sampler2D";

export interface UniformDeclaration {
  key: string;
  glslType: GlslType;
  default: number | number[] | boolean;
  range?: { min: number; max: number; step?: number };
  label?: string;
}

export type ProcessingPhase =
  | "geometry"
  | "decode"
  | "noise-reduction"
  | "scene-linear"
  | "tone-map"
  | "display-adjust"
  | "effects"
  | "output-encode";

export interface StageSpace {
  encoding: "linear" | "perceptual";
  primaries?: "rec709" | "rec2020";
}

export interface ProcessingStageContribution {
  id: string;
  name: string;
  phase: ProcessingPhase;
  priority?: number;
  glsl: string;
  helpers?: string;
  uniforms: UniformDeclaration[];
  presetScope?: "global" | "per-image";
  space?: StageSpace;
  /** Runs the stage again inside each mask whose bag holds its keys, with that
   *  mask's values, blended by its coverage (Safelight 3.1.0, process version 2
   *  photos). */
  mask?: { maskable: true };
  /** Stage ids this one runs after inside its phase; an id that isn't
   *  registered, or sits in another phase, is ignored (Safelight 3.1.0). */
  after?: string[];
}

export interface PanelContribution {
  id: string;
  title: string;
  component: ComponentType;
  defaultDock?: {
    module: "library" | "develop";
    direction: "left" | "right" | "bottom";
    order?: number;
    width?: number;
    height?: number;
  };
  onReset?: () => void;
  /** Offers the panel in a mask's Adjust tab: each mask that adds it renders
   *  `component`, which edits that mask's values through useParamScope. `owns`
   *  lists every qualified key it writes, seeded on add and cleared on remove. */
  mask?: { component: ComponentType; order?: number; owns: readonly string[] };
}

/** The params a panel edits: the photo's bag, or one mask's (maskId set).
 *  Reads see the store as it is now, not as the render was handed it. */
export interface ParamScope {
  maskId: string | null;
  getParam(key: string): unknown;
  /** The stored values by qualified key, without defaults. */
  getParams(): Readonly<Record<string, unknown>>;
  setParams(patch: Record<string, unknown>): void;
  commit(label: string): void;
}

export interface SlotContribution {
  id: string;
  slot: "develop-canvas-overlay" | "develop-toolbar" | "library-toolbar" | "library-subbar";
  component: ComponentType;
  order?: number;
}

export interface CaptureOptions {
  asShown?: boolean;
  /** Merged over the photo's extension-stage params for this capture only. */
  paramBag?: Record<string, unknown>;
}

/** The core Develop slider (src/ui/components/Slider.tsx). */
export interface SliderProps {
  label: string;
  value: number;
  onChange(value: number): void;
  onCommit?(): void;
  min?: number;
  max?: number;
  step?: number;
  /** Double-clicking the track resets to this. */
  defaultValue?: number;
  hideValue?: boolean;
  compact?: boolean;
  /** CSS background for the track (a hue or chroma gradient); the fill bar
   *  becomes a marker so the gradient stays visible. */
  trackBackground?: string;
}

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  active?: boolean;
  full?: boolean;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  onClick?(): void;
  children?: ReactNode;
}

export interface RowProps {
  children?: ReactNode;
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  style?: CSSProperties;
}

export interface StackProps {
  children?: ReactNode;
  gap?: number;
  style?: CSSProperties;
}

export interface UiKit {
  Button: ComponentType<ButtonProps>;
  Row: ComponentType<RowProps>;
  Stack: ComponentType<StackProps>;
  tokens: Readonly<Record<string, string>>;
}

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  react: typeof import("react");
  registerProcessingStage(c: ProcessingStageContribution): void;
  unregisterProcessingStage(id: string): void;
  registerPanel(c: PanelContribution): void;
  registerSlot(c: SlotContribution): void;
  unregisterSlot(id: string): void;
  components: {
    Slider: ComponentType<SliderProps>;
  };
  ui: UiKit;
  stores: {
    create<T>(init: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
  };
  cursors: {
    resolve(token: string): string;
  };
  develop: {
    useDevelopOverlay(): DevelopOverlayState;
    captureFrame(params: DevelopParams, options?: CaptureOptions): Promise<ImageBitmap>;
    /** The mask's scope inside a mask's Adjust tab, the photo's anywhere else. */
    useParamScope(): ParamScope;
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
