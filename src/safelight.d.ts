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
  setDynParams(patch: Record<string, unknown>): void;
  commitEdit(label: string): Promise<void>;
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

/** Display-encoded sRGB, 0 to 1. */
export type Rgb = readonly [number, number, number];

export interface Hsl {
  /** Degrees, 0 to 360. */
  hue: number;
  /** Percent, 0 to 100. */
  saturation: number;
  /** Percent, 0 to 100. */
  lightness: number;
}

/** The channels a field has: always hue, saturation and lightness when given. */
export interface ColourValue {
  hue: number;
  saturation?: number;
  lightness?: number;
}

export interface ColourFieldProps {
  label: string;
  /** Degrees, 0 to 360. */
  hue: number;
  /** Percent, 0 to 100. Leave it out for a hue-only field. */
  saturation?: number;
  /** Percent, 0 to 100. Give it for a field that also sets lightness. */
  lightness?: number;
  /** Live while a drag lasts, and once for a key, hex or pick; carries the
   *  field's channels only. */
  onChange(value: ColourValue): void;
  /** A drag ended, or a key, hex or pick changed the colour. */
  onCommit?(): void;
  /** The colour to show for hue, saturation and lightness (a missing channel
   *  comes as 100 and 50), display sRGB 0 to 1. Default: HSL. */
  toRgb?(hue: number, saturation: number, lightness: number): Rgb;
  /** A typed or picked colour (display sRGB 0 to 1) in the field's channels.
   *  Default: HSL. */
  fromRgb?(rgb: Rgb): Hsl;
  /** The eyedropper. `true` (the default) takes the colour the view shows;
   *  `{ paramBag }` samples a capture with that bag merged over the photo's,
   *  to leave the extension's own effect out; `false` hides it. */
  pick?: boolean | {
    paramBag: Record<string, unknown>;
  };
  /** The swatch's tooltip. */
  title?: string;
}

export interface UiKit {
  Button: ComponentType<ButtonProps>;
  Row: ComponentType<RowProps>;
  Stack: ComponentType<StackProps>;
  ColourField(props: ColourFieldProps): import("react").JSX.Element;
  tokens: Readonly<Record<string, string>>;
}

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  react: typeof import("react");
  registerProcessingStage(c: ProcessingStageContribution): void;
  unregisterProcessingStage(id: string): void;
  registerPanel(c: PanelContribution): void;
  components: {
    Slider: ComponentType<SliderProps>;
  };
  ui: UiKit;
  stores: {
    create<T>(init: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
  };
  develop: {
    /** The mask's scope inside a mask's Adjust tab, the photo's anywhere else. */
    useParamScope(): ParamScope;
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
