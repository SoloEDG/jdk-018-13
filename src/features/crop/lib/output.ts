import type { Asset, Crop } from "../../../shared/document";
import {
  clamp,
  distance,
  formatRatio,
  inferAspect,
  ratioValue,
  toPixels,
  type AspectEstimate,
} from "./geometry";

export const MIN_LONG_EDGE = 320;
export const MAX_LONG_EDGE = 2560;

export interface CropLayout {
  width: number;
  height: number;
  aspect: number;
  /** Output long edge before the hard safety clamp. */
  requestedLongEdge: number;
  /** Perspective-derived aspect. Only available for quad crops. */
  estimate: AspectEstimate | null;
  autoSized: boolean;
  /** True when a fixed ratio overrides the perspective-derived aspect. */
  ratioForced: boolean;
  ratioLabel: string;
}

/**
 * Long edge that the quad actually resolves in source pixels. Under strong
 * obliquity the far edge is compressed, so the conservative `min` of each
 * opposite pair is used: auto sizing never invents detail the source lacks.
 */
export function autoLongEdge(
  corners: Crop["corners"],
  width: number,
  height: number,
): number {
  const px = toPixels(corners, width, height);
  const top = distance(px[0]!, px[1]!);
  const bottom = distance(px[3]!, px[2]!);
  const left = distance(px[0]!, px[3]!);
  const right = distance(px[1]!, px[2]!);
  const usableWidth = Math.min(top, bottom);
  const usableHeight = Math.min(left, right);
  return clamp(Math.round(Math.max(usableWidth, usableHeight)), 320, 2400);
}

/**
 * Resolve the pixel size of the rectified plane.
 *
 * Sizing and aspect are separate decisions:
 * - `aspect` is either inferred from the quad's perspective (auto) or fixed
 *   by the user; a fixed ratio that disagrees with the inference stretches
 *   the plane to that ratio on purpose.
 * - `longEdge` is either fixed by the user (reproducible exports) or derived
 *   from how many source pixels the quad covers (auto).
 */
export function cropLayout(crop: Crop, asset: Asset): CropLayout {
  if (crop.mode === "rect") {
    const width = Math.max(1, Math.round(crop.width * asset.width));
    const height = Math.max(1, Math.round(crop.height * asset.height));
    return {
      width,
      height,
      aspect: width / height,
      requestedLongEdge: Math.max(width, height),
      estimate: null,
      autoSized: false,
      ratioForced: false,
      ratioLabel: formatRatio(width / height),
    };
  }

  const estimate = inferAspect(crop.corners, asset.width, asset.height);
  const manual = ratioValue(crop);
  const aspect = clamp(manual ?? estimate.aspect, 0.08, 12);
  const ratioForced =
    manual !== null && Math.abs(manual - estimate.aspect) / estimate.aspect > 0.04;
  const auto = manual === null;
  const label = formatRatio(manual ?? aspect);
  const ratioLabel =
    auto && estimate.confidence === "low" ? `≈ ${label}` : label;
  const requestedLongEdge =
    crop.sizing === "auto"
      ? autoLongEdge(crop.corners, asset.width, asset.height)
      : Number.isFinite(crop.longEdge)
        ? crop.longEdge
        : 1080;
  const longEdge = Math.round(
    clamp(requestedLongEdge, MIN_LONG_EDGE, MAX_LONG_EDGE),
  );
  const width = Math.max(
    1,
    Math.round(aspect >= 1 ? longEdge : longEdge * aspect),
  );
  const height = Math.max(
    1,
    Math.round(aspect >= 1 ? longEdge / aspect : longEdge),
  );
  return {
    width,
    height,
    aspect,
    requestedLongEdge,
    estimate,
    autoSized: crop.sizing === "auto",
    ratioForced,
    ratioLabel,
  };
}
