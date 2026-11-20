import type { Crop, StudioDocument } from "./document";
export const DEFAULT_LONG_EDGE = 1080;
/** The untransformed, full-image rectangle crop. */
export function fullCrop(): Crop {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    mode: "rect",
    corners: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    ratio: "auto",
    sizing: "fixed",
    longEdge: DEFAULT_LONG_EDGE,
  };
}
export function createDocument(): StudioDocument {
  return {
    asset: null,
    crop: fullCrop(),
    settings: {
      columns: 100,
      charset: "standard",
      custom: " .:-=+*#%@",
      contrast: 1,
      gamma: 1,
      invert: false,
      color: true,
      background: "#101216",
    },
    grid: null,
    revision: 0,
  };
}
