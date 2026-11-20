export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type CropMode = "rect" | "quad";
export type RatioId = "auto" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
export type SizingMode = "fixed" | "auto";
export interface Crop extends Rect {
  mode: CropMode;
  /** Clockwise from the top-left corner, normalized to the source image. */
  corners: [Point, Point, Point, Point];
  ratio: RatioId;
  sizing: SizingMode;
  /** Long edge in pixels when sizing is fixed. */
  longEdge: number;
}
export interface Asset {
  name: string;
  url: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}
export interface Settings {
  columns: number;
  charset: string;
  custom: string;
  contrast: number;
  gamma: number;
  invert: boolean;
  color: boolean;
  background: string;
}
export interface Cell {
  glyph: string;
  color: string;
}
export interface Grid {
  columns: number;
  rows: number;
  cells: Cell[];
  revision: number;
}
export interface StudioDocument {
  asset: Asset | null;
  crop: Crop;
  settings: Settings;
  grid: Grid | null;
  revision: number;
}
