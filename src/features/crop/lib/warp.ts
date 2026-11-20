import type { Asset } from "../../../shared/document";
import { planeSampler, clearSourcePixels } from "./projection";
import type { Corners } from "./geometry";

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export interface WarpOptions {
  /**
   * Longest edge of the internal source copy used for sampling. The exact
   * projective transform is always applied; this only bounds sampling
   * resolution and is the one knob allowed to be lowered for drag previews.
   */
  sourceLongEdge?: number;
  background?: string;
}

/**
 * Rectify the quad to a `width × height` raster with the exact projective
 * map and bilinear sampling. Not an affine shortcut: lines stay straight and
 * the four corners land on the output corners.
 */
export function warpPlane(
  asset: Asset,
  corners: Corners,
  width: number,
  height: number,
  options: WarpOptions = {},
): HTMLCanvasElement {
  const out = createCanvas(width, height);
  const g = out.getContext("2d")!;
  const background = options.background ?? "#101216";
  g.fillStyle = background;
  g.fillRect(0, 0, out.width, out.height);

  const sampler = planeSampler(asset, corners, options.sourceLongEdge ?? 2400);
  if (!sampler.forward) return out;
  const image = g.createImageData(out.width, out.height);
  const target = image.data;
  const bg = parseBackground(background);
  for (let y = 0; y < out.height; y++) {
    const v = (y + 0.5) / out.height;
    for (let x = 0; x < out.width; x++) {
      const u = (x + 0.5) / out.width;
      const rgb = sampler.at(u, v);
      const index = (y * out.width + x) * 4;
      if (rgb) {
        target[index] = rgb[0];
        target[index + 1] = rgb[1];
        target[index + 2] = rgb[2];
      } else {
        target[index] = bg[0];
        target[index + 1] = bg[1];
        target[index + 2] = bg[2];
      }
      target[index + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return out;
}

function parseBackground(value: string): [number, number, number] {
  const hex = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return [16, 18, 22];
}

const fullCache = new WeakMap<Asset, Map<string, HTMLCanvasElement>>();

export function cachedWarp(
  asset: Asset,
  corners: Corners,
  width: number,
  height: number,
  maxLongEdge: number,
  background: string,
): HTMLCanvasElement {
  const key = [
    corners.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`).join(";"),
    width,
    height,
    maxLongEdge,
    background,
  ].join("|");
  let cache = fullCache.get(asset);
  if (!cache) {
    cache = new Map();
    fullCache.set(asset, cache);
  }
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = warpPlane(asset, corners, width, height, {
    sourceLongEdge: maxLongEdge,
    background,
  });
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
  return canvas;
}

export function clearWarpCache(asset: Asset) {
  clearSourcePixels(asset);
  fullCache.delete(asset);
}
