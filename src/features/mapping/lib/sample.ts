import type { Asset, Crop } from "../../../shared/document";
import {
  cropSource,
  DRAFT_RECTIFY_EDGE,
  FULL_RECTIFY_EDGE,
  type CropSource,
} from "./rectify";

export interface SampleResult {
  pixels: Uint8ClampedArray;
  /** True when the crop was perspective-corrected before sampling. */
  rectified: boolean;
}

export interface SampleOptions {
  /**
   * Fidelity of the rectified raster for quad crops. Drag previews use
   * `draft`; commit/confirm/export always use `full`. The transform itself is
   * identical in both cases, only the intermediate raster is smaller.
   */
  quality?: "draft" | "full";
  /** Precomputed crop source, to avoid rectifying twice per generate. */
  source?: CropSource;
}

export function sample(
  asset: Asset,
  crop: Crop,
  columns: number,
  rows: number,
  background: string,
  options: SampleOptions = {},
): SampleResult {
  const source =
    options.source ??
    cropSource(asset, crop, {
      rectifyEdge:
        options.quality === "draft" ? DRAFT_RECTIFY_EDGE : FULL_RECTIFY_EDGE,
    });
  const c = document.createElement("canvas");
  c.width = columns;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = background;
  g.fillRect(0, 0, columns, rows);
  // Browser area averaging beats manual point sampling for the many-to-one
  // reduction into glyph cells.
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(
    source.image,
    source.sx,
    source.sy,
    source.sw,
    source.sh,
    0,
    0,
    columns,
    rows,
  );
  return {
    pixels: g.getImageData(0, 0, columns, rows).data,
    rectified: crop.mode === "quad",
  };
}
