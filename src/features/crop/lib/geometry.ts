import type {
  Crop,
  CropMode,
  Point,
  RatioId,
  Rect,
} from "../../../shared/document";

export type Corners = [Point, Point, Point, Point];
export type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface RatioOption {
  id: RatioId;
  label: string;
  value: number | null;
}
export const RATIOS: RatioOption[] = [
  { id: "auto", label: "自动（透视推断）", value: null },
  { id: "1:1", label: "1 : 1", value: 1 },
  { id: "4:3", label: "4 : 3", value: 4 / 3 },
  { id: "3:4", label: "3 : 4", value: 3 / 4 },
  { id: "16:9", label: "16 : 9", value: 16 / 9 },
  { id: "9:16", label: "9 : 16", value: 9 / 16 },
];
export const MIN_CORNER_ANGLE = 10;
const EDGE_TOLERANCE = 1e-6;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function cornersFromRect(r: Rect): Corners {
  const x2 = r.x + r.width;
  const y2 = r.y + r.height;
  return [
    { x: r.x, y: r.y },
    { x: x2, y: r.y },
    { x: x2, y: y2 },
    { x: r.x, y: y2 },
  ];
}

export function rectFromCorners(corners: Corners): Rect {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = clamp(Math.min(...xs), 0, 0.99);
  const y = clamp(Math.min(...ys), 0, 0.99);
  return {
    x,
    y,
    width: clamp(Math.max(...xs) - x, 0.01, 1 - x),
    height: clamp(Math.max(...ys) - y, 0.01, 1 - y),
  };
}

export function cloneCorners(corners: Corners): Corners {
  return corners.map((p) => ({ x: p.x, y: p.y })) as Corners;
}

export function effectiveRect(crop: Crop): Rect {
  if (crop.mode === "quad") return rectFromCorners(crop.corners);
  return normalizeCrop(crop);
}

export function cropWithRect(base: Crop, r: Rect): Crop {
  const rect = normalizeCrop(r);
  return {
    ...base,
    ...rect,
    mode: "rect",
    corners: cornersFromRect(rect),
  };
}

export function cropWithCorners(base: Crop, corners: Corners): Crop {
  const copy = cloneCorners(corners);
  return {
    ...base,
    ...rectFromCorners(copy),
    mode: "quad",
    corners: copy,
  };
}

export function cropWithSettings(
  base: Crop,
  patch: Partial<Pick<Crop, "ratio" | "sizing" | "longEdge">>,
): Crop {
  return { ...base, ...patch };
}

export function cropWithMode(base: Crop, mode: CropMode): Crop {
  if (mode === "quad" && base.mode !== "quad") {
    return { ...base, mode: "quad", corners: cornersFromRect(effectiveRect(base)) };
  }
  if (mode === "rect" && base.mode !== "rect") {
    return cropWithRect(base, effectiveRect(base));
  }
  return { ...base };
}

export function normalizeCrop(c: Rect): Rect {
  const x = clamp(Number.isFinite(c.x) ? c.x : 0, 0, 0.99);
  const y = clamp(Number.isFinite(c.y) ? c.y : 0, 0, 0.99);
  const width = clamp(
    Number.isFinite(c.width) ? c.width : 1,
    0.01,
    1 - x,
  );
  const height = clamp(
    Number.isFinite(c.height) ? c.height : 1,
    0.01,
    1 - y,
  );
  return { x, y, width, height };
}

export function cropFromPoints(
  x: number,
  y: number,
  ex: number,
  ey: number,
): Rect {
  return normalizeCrop({
    x: Math.min(x, ex),
    y: Math.min(y, ey),
    width: Math.abs(ex - x),
    height: Math.abs(ey - y),
  });
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function toPixels(
  corners: Corners,
  width: number,
  height: number,
): Corners {
  return corners.map((p) => ({ x: p.x * width, y: p.y * height })) as Corners;
}

export function signedArea(corners: Corners): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function crossOf(prev: Point, here: Point, next: Point): number {
  return (
    (here.x - prev.x) * (next.y - here.y) -
    (here.y - prev.y) * (next.x - here.x)
  );
}

export type Validation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateCorners(
  corners: Corners,
  imageWidth: number,
  imageHeight: number,
): Validation {
  if (corners.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return { ok: false, reason: "角点坐标无效" };
  const outside = corners.some(
    (p) =>
      p.x < -EDGE_TOLERANCE ||
      p.y < -EDGE_TOLERANCE ||
      p.x > 1 + EDGE_TOLERANCE ||
      p.y > 1 + EDGE_TOLERANCE,
  );
  if (outside) return { ok: false, reason: "角点超出原图范围，请拖回画面内" };

  const px = toPixels(corners, imageWidth, imageHeight);
  const diagonal = Math.hypot(imageWidth, imageHeight);
  const minEdge = Math.max(6, diagonal * 0.012);
  for (let i = 0; i < 4; i++) {
    if (distance(px[i]!, px[(i + 1) % 4]!) < minEdge)
      return { ok: false, reason: "边线过短，四个角点过于接近" };
  }

  const area = Math.abs(signedArea(px));
  if (area < Math.max(400, imageWidth * imageHeight * 0.002))
    return { ok: false, reason: "选取区域过小，请扩大范围" };

  const minSin = Math.sin((MIN_CORNER_ANGLE * Math.PI) / 180);
  for (let i = 0; i < 4; i++) {
    const prev = px[(i + 3) % 4]!;
    const here = px[i]!;
    const next = px[(i + 1) % 4]!;
    const cross = crossOf(prev, here, next);
    const norm = distance(prev, here) * distance(here, next);
    if (cross <= 0)
      return { ok: false, reason: "角点交叉或顺序错乱，请保持四角顺时针次序" };
    if (norm > 0 && cross / norm < minSin)
      return { ok: false, reason: "角点接近共线，请拉开相邻角点" };
  }

  if (!unitSquareToQuad(corners)) return { ok: false, reason: "四边形退化，无法计算透视" };
  if (!stableProjection(unitSquareToQuad(corners)!))
    return { ok: false, reason: "透视过于极端，请调整角点避免画面被撕裂" };
  return { ok: true };
}

/**
 * A quad whose plane crosses the camera's vanishing line has a homography
 * whose denominator changes sign inside the unit square: sampling it mirrors
 * or tears the image. Require one consistent sign at all corners and centre.
 */
export function stableProjection(m: Mat3): boolean {
  const probes: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.5, 0.5],
  ];
  let sign = 0;
  for (const [u, v] of probes) {
    const w = m[6] * u + m[7] * v + m[8];
    if (!Number.isFinite(w) || Math.abs(w) < 1e-6) return false;
    const s = Math.sign(w);
    if (sign !== 0 && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Homography mapping the unit square to the given (normalized) quad. */
export function unitSquareToQuad(corners: Corners): Mat3 | null {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  const m: Mat3 = [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
  return m.every(Number.isFinite) ? m : null;
}

export function invertMat3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null;
  const inv: Mat3 = [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
  return inv.every(Number.isFinite) ? inv : null;
}

export function project(m: Mat3, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return {
    x: (m[0] * x + m[1] * y + m[2]) / w,
    y: (m[3] * x + m[4] * y + m[5]) / w,
  };
}

export type AspectConfidence = "high" | "low";
export interface AspectEstimate {
  aspect: number;
  confidence: AspectConfidence;
  /** The projected edge ratio, used as a fallback when calibration is unstable. */
  naive: number;
}

/**
 * Estimate the aspect ratio of the physical rectangle behind a perspective
 * quad. Uses the two vanishing points of the quad against a centred principal
 * point and square pixels (single-view plane rectification); the ratio of the
 * metric column norms is the physical aspect.
 *
 * The estimate degenerates when both vanishing directions sit near the image
 * centre (a nearly frontal shot): tiny pixel noise then flips the sign of the
 * recovered focal length. Such cases are reported as low confidence and fall
 * back to the projected edge ratio, which is well behaved exactly there.
 */
export function inferAspect(
  corners: Corners,
  imageWidth: number,
  imageHeight: number,
): AspectEstimate {
  const px = toPixels(corners, imageWidth, imageHeight);
  const naiveTop = distance(px[0]!, px[1]!);
  const naiveLeft = distance(px[0]!, px[3]!);
  const naiveBottom = distance(px[3]!, px[2]!);
  const naiveRight = distance(px[1]!, px[2]!);
  const naiveWidth = Math.sqrt(naiveTop * Math.max(naiveBottom, 1e-6));
  const naiveHeight = Math.sqrt(naiveLeft * Math.max(naiveRight, 1e-6));
  const naive = naiveWidth / Math.max(naiveHeight, 1e-6);
  const fallback: AspectEstimate = {
    aspect: clamp(naive, 0.08, 12) || 1,
    confidence: "low",
    naive,
  };
  const H = unitSquareToQuad(px);
  if (!H) return fallback;

  const [h0, h1, , h3, h4, , h6, h7] = H;
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  // Both vanishing points must exist and sit well away from the principal
  // point; otherwise the calibration is ill-conditioned and cannot be trusted.
  const vx = cx + (h0 - cx * h6) / h6;
  const vy = cy + (h3 - cy * h6) / h6;
  const wx = cx + (h1 - cx * h7) / h7;
  const wy = cy + (h4 - cy * h7) / h7;
  const spread = Math.hypot(imageWidth, imageHeight);
  if (Math.abs(h6) < 1e-8 || Math.abs(h7) < 1e-8) return fallback;
  if (!Number.isFinite(vx + vy + wx + wy)) return fallback;
  if (
    Math.hypot(vx - cx, vy - cy) < spread * 0.25 ||
    Math.hypot(wx - cx, wy - cy) < spread * 0.25
  )
    return fallback;

  // Square pixels + centred principal point: the two columns of the plane-to-
  // image homography are orthogonal in camera space, which fixes f.
  const ax = h0 - cx * h6;
  const ay = h3 - cy * h6;
  const bx = h1 - cx * h7;
  const by = h4 - cy * h7;
  const f2 = -(ax * bx + ay * by) / (h6 * h7);
  const maxDim = Math.max(imageWidth, imageHeight);
  // A recovered focal length below the image scale is physically impossible.
  if (!(f2 > 0) || !Number.isFinite(f2)) return fallback;
  const f = Math.sqrt(f2);
  if (f < maxDim * 0.5 || f > maxDim * 20) return fallback;

  // Column norms are the metric lengths of the two unit basis vectors; their
  // ratio is the physical aspect of the picked rectangle.
  const g1 = Math.hypot(ax / f, ay / f, h6);
  const g2 = Math.hypot(bx / f, by / f, h7);
  const aspect = g1 / Math.max(g2, 1e-9);
  if (!Number.isFinite(aspect) || aspect < 0.08 || aspect > 12) return fallback;
  return { aspect, confidence: "high", naive };
}

export function ratioValue(crop: Crop): number | null {
  return RATIOS.find((r) => r.id === crop.ratio)?.value ?? null;
}

export function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const known = RATIOS.find(
    (r) => r.value !== null && Math.abs(r.value - value) < 0.02,
  );
  if (known) return known.label.replace(/\s/g, "");
  return value >= 1
    ? `${value.toFixed(2)} : 1`
    : `1 : ${(1 / value).toFixed(2)}`;
}
