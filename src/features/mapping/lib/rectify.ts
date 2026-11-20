import type { Asset, Crop } from "../../../shared/document";
import { cropLayout } from "../../crop/lib/output";
import {
  cornersFromRect,
  effectiveRect,
  type Corners,
} from "../../crop/lib/geometry";
import { cachedWarp } from "../../crop/lib/warp";

/** Long-edge cap for the rectified raster used at full quality. */
export const FULL_RECTIFY_EDGE = 2400;
/** Long-edge cap for the rectified raster used during drag previews. */
export const DRAFT_RECTIFY_EDGE = 640;

export interface CropSource {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Aspect of the sampled picture after correction. */
  aspect: number;
}

export interface CropSourceOptions {
  /** Long-edge cap of the rectified raster for quad crops. */
  rectifyEdge?: number;
}

/**
 * What glyph sampling reads. Quad crops read an already-rectified raster, so
 * density always samples the corrected picture, never the skewed quad.
 */
export function cropSource(
  asset: Asset,
  crop: Crop,
  options: CropSourceOptions = {},
): CropSource {
  if (crop.mode === "quad") {
    const layout = cropLayout(crop, asset);
    const plane = rectifiedRaster(
      asset,
      crop,
      options.rectifyEdge ?? FULL_RECTIFY_EDGE,
    );
    return {
      image: plane,
      sx: 0,
      sy: 0,
      sw: plane.width,
      sh: plane.height,
      aspect: layout.width / layout.height,
    };
  }
  const rect = effectiveRect(crop);
  return {
    image: asset.image,
    sx: rect.x * asset.width,
    sy: rect.y * asset.height,
    sw: rect.width * asset.width,
    sh: rect.height * asset.height,
    aspect: (rect.width * asset.width) / (rect.height * asset.height),
  };
}

/** Rectified raster of the quad, preserving the configured output aspect. */
export function rectifiedRaster(
  asset: Asset,
  crop: Crop,
  maxLongEdge = FULL_RECTIFY_EDGE,
): HTMLCanvasElement {
  const layout = cropLayout(crop, asset);
  const longest = Math.max(layout.width, layout.height);
  const scale = Math.min(1, maxLongEdge / Math.max(1, longest));
  const width = Math.max(1, Math.round(layout.width * scale));
  const height = Math.max(1, Math.round(layout.height * scale));
  return cachedWarp(
    asset,
    cropCorners(crop),
    width,
    height,
    maxLongEdge,
    "#101216",
  );
}

/** Corners used for display and rectified previews. */
export function cropCorners(crop: Crop): Corners {
  return crop.mode === "quad"
    ? crop.corners
    : cornersFromRect(effectiveRect(crop));
}
