import type { Asset } from "../../../shared/document";
import {
  invertMat3,
  toPixels,
  unitSquareToQuad,
  type Corners,
  type Mat3,
} from "./geometry";

/** Bilinear RGBA source lookup in pixel space of a cached downscale. */
export interface SourcePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  at(x: number, y: number): [number, number, number] | null;
}

const pixels = new WeakMap<Asset, Map<number, SourcePixels>>();

function buildPixels(asset: Asset, maxLongEdge: number): SourcePixels {
  const longest = Math.max(asset.width, asset.height);
  const scale = Math.min(1, maxLongEdge / Math.max(1, longest));
  const width = Math.max(1, Math.round(asset.width * scale));
  const height = Math.max(1, Math.round(asset.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(asset.image, 0, 0, width, height);
  const data = g.getImageData(0, 0, width, height).data;
  return {
    width,
    height,
    data,
    at(x: number, y: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return null;
      const px = x - 0.5;
      const py = y - 0.5;
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const fx = px - x0;
      const fy = py - y0;
      const xa = Math.max(0, Math.min(width - 1, x0));
      const xb = Math.max(0, Math.min(width - 1, x0 + 1));
      const ya = Math.max(0, Math.min(height - 1, y0));
      const yb = Math.max(0, Math.min(height - 1, y0 + 1));
      const i00 = (ya * width + xa) * 4;
      const i10 = (ya * width + xb) * 4;
      const i01 = (yb * width + xa) * 4;
      const i11 = (yb * width + xb) * 4;
      const out: [number, number, number] = [0, 0, 0];
      for (let ch = 0; ch < 3; ch++) {
        const top = data[i00 + ch]! + (data[i10 + ch]! - data[i00 + ch]!) * fx;
        const bottom =
          data[i01 + ch]! + (data[i11 + ch]! - data[i01 + ch]!) * fx;
        out[ch] = top + (bottom - top) * fy;
      }
      return out;
    },
  };
}

/** Cached downscaled pixel buffer; `maxLongEdge` caps its longest side. */
export function sourcePixels(asset: Asset, maxLongEdge = 2400): SourcePixels {
  let byEdge = pixels.get(asset);
  if (!byEdge) {
    byEdge = new Map();
    pixels.set(asset, byEdge);
  }
  const hit = byEdge.get(maxLongEdge);
  if (hit) return hit;
  const built = buildPixels(asset, maxLongEdge);
  if (byEdge.size >= 3) byEdge.delete(byEdge.keys().next().value!);
  byEdge.set(maxLongEdge, built);
  return built;
}

export function clearSourcePixels(asset: Asset) {
  pixels.delete(asset);
}

export interface PlaneSampler {
  /** Quad → source pixel homography (pixel units of the cached source). */
  forward: Mat3 | null;
  inverse: Mat3 | null;
  source: SourcePixels;
  /** Sample plane coordinate (u,v) ∈ [0,1]² with bilinear filtering. */
  at(u: number, v: number): [number, number, number] | null;
}

/**
 * Exact projective sampler independent of output raster size: increasing
 * glyph density only adds sample points, it never changes the geometry.
 */
export function planeSampler(
  asset: Asset,
  corners: Corners,
  maxLongEdge = 2400,
): PlaneSampler {
  const source = sourcePixels(asset, maxLongEdge);
  const forward = unitSquareToQuad(
    toPixels(corners, source.width, source.height),
  );
  const inverse = forward ? invertMat3(forward) : null;
  return {
    forward,
    inverse,
    source,
    at(u, v) {
      if (!forward) return null;
      const w = forward[6] * u + forward[7] * v + forward[8];
      if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
      const x = (forward[0] * u + forward[1] * v + forward[2]) / w;
      const y = (forward[3] * u + forward[4] * v + forward[5]) / w;
      return source.at(x, y);
    },
  };
}
