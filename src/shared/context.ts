import type { InjectionKey, Ref, ShallowRef } from "vue";
import type { Crop, Grid, StudioDocument } from "./document";
export interface StudioContext {
  doc: StudioDocument;
  busy: Ref<boolean>;
  notice: Ref<string>;
  invalidate: () => void;
  /** True while a draft-quality drag preview is active. */
  previewing: Ref<boolean>;
  /** Draft-quality grid for the crop currently being dragged. */
  previewGrid: ShallowRef<Grid | null>;
  /** Arm or clear the drag preview. `null` clears it. */
  setPreview: (crop: Crop | null) => void;
}
export const studioKey: InjectionKey<StudioContext> = Symbol("studio");
