export interface GridSize {
  columns: number;
  rows: number;
}
/**
 * Rows follow the glyph cell's 1:2 (width:height) shape so the ASCII picture
 * keeps the corrected plane's aspect: rows ≈ columns / (2 · aspect).
 */
export function gridSize(aspect: number, columns: number): GridSize {
  const n = Math.round(Math.max(30, Math.min(220, columns)));
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error("裁剪区域无效，请重新框选");
  }
  const rows = Math.max(1, Math.round(n / (2 * aspect)));
  if (!Number.isFinite(rows) || rows > 1200) {
    throw new Error("裁剪区域过于狭长，请缩小范围或降低字符密度");
  }
  return { columns: n, rows };
}
