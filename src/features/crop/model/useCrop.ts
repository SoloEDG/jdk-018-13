import { computed, ref } from "vue";
import type { Crop, Point, Rect } from "../../../shared/document";
import { useStudio } from "../../../shared/useStudio";
import { fullCrop } from "../../../shared/defaults";
import {
  cloneCorners,
  cornersFromRect,
  cropFromPoints,
  cropWithCorners,
  cropWithMode,
  cropWithRect,
  cropWithSettings,
  distance,
  effectiveRect,
  normalizeCrop,
  validateCorners,
  type Corners,
} from "../lib/geometry";

const HANDLE_HIT = 16;

/**
 * The coordinate frame is the image itself, not the padded interaction box,
 * so handles that sit on the image border remain fully grabbable.
 */
function frameOf(element: HTMLElement): DOMRect {
  const frame = element.querySelector<HTMLElement>(".crop-image");
  return (frame ?? element).getBoundingClientRect();
}

export function useCrop() {
  const { doc, invalidate, notice, setPreview } = useStudio();
  const dragging = ref<number | null>(null);
  const draftCorners = ref<Corners | null>(null);
  const draftRect = ref<Rect | null>(null);
  const error = ref("");
  const rectStart = ref<Point | null>(null);
  // Last quad that passed validation during the current gesture. Used when the
  // pointer is released on an invalid position: we commit this instead of
  // discarding the whole gesture.
  const lastValid = ref<Corners | null>(null);
  const active = computed(() => dragging.value !== null || rectStart.value !== null);
  // Normalized-unit → screen-pixel scale, refreshed per gesture so handle hit
  // radii stay constant on screen regardless of preview size.
  let span = { w: 1, h: 1 };

  function cornersOf(crop: Crop): Corners {
    return crop.mode === "quad"
      ? crop.corners
      : cornersFromRect(normalizeCrop(crop));
  }

  function updateSpan(element: HTMLElement) {
    const box = frameOf(element);
    span = { w: Math.max(1, box.width), h: Math.max(1, box.height) };
  }

  function point(e: PointerEvent): Point {
    const box = frameOf(e.currentTarget as HTMLElement);
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  }

  /** Unclamped point so dragging outside the image is detected and rejected. */
  function rawPoint(e: PointerEvent): Point {
    const box = frameOf(e.currentTarget as HTMLElement);
    return {
      x: (e.clientX - box.left) / Math.max(1, box.width),
      y: (e.clientY - box.top) / Math.max(1, box.height),
    };
  }

  function nearestCorner(point: Point): number {
    const corners = cornersOf(doc.crop);
    let best = Infinity;
    let hit = 0;
    for (let i = 0; i < corners.length; i++) {
      const dx = (corners[i]!.x - point.x) * span.w;
      const dy = (corners[i]!.y - point.y) * span.h;
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        hit = i;
      }
    }
    return best <= HANDLE_HIT ? hit : -1;
  }

  function down(e: PointerEvent) {
    if (!doc.asset) return;
    if (e.button !== undefined && e.button !== 0) return;
    const element = e.currentTarget as HTMLElement;
    updateSpan(element);
    const p = point(e);
    element.setPointerCapture(e.pointerId);
    error.value = "";

    if (doc.crop.mode === "quad") {
      const hit = nearestCorner(p);
      if (hit >= 0) {
        dragging.value = hit;
        const start = cornersOf(doc.crop);
        draftCorners.value = cloneCorners(start);
        lastValid.value = cloneCorners(start);
      }
      return;
    }
    // Rect mode keeps the original drag-out selection.
    rectStart.value = p;
    draftRect.value = cropFromPoints(p.x, p.y, p.x, p.y);
  }

  function move(e: PointerEvent) {
    if (dragging.value !== null) {
      const next = cloneCorners(draftCorners.value!);
      next[dragging.value] = rawPoint(e);
      draftCorners.value = next;
      const verdict = validateCorners(
        next,
        doc.asset!.width,
        doc.asset!.height,
      );
      error.value = verdict.ok ? "" : verdict.reason;
      // Feed only geometrically valid quads to the draft preview. On an
      // invalid move the previous valid draft frame stays on screen, so the
      // user never sees a torn or flickering image.
      if (verdict.ok) {
        lastValid.value = cloneCorners(next);
        setPreview(cropWithCorners(doc.crop, next));
      }
      return;
    }
    if (rectStart.value) {
      draftRect.value = cropFromPoints(
        rectStart.value.x,
        rectStart.value.y,
        point(e).x,
        point(e).y,
      );
    }
  }

  function up(e: PointerEvent) {
    if (rectStart.value) {
      const rect = draftRect.value;
      rectStart.value = null;
      draftRect.value = null;
      if (rect && rect.width > 0.005 && rect.height > 0.005) {
        doc.crop = cropWithRect(doc.crop, rect);
        invalidate();
      }
      return;
    }
    if (dragging.value === null) return;
    updateSpan(e.currentTarget as HTMLElement);
    const candidate = draftCorners.value!;
    const fallback = lastValid.value;
    dragging.value = null;
    draftCorners.value = null;
    lastValid.value = null;
    const verdict = validateCorners(
      candidate,
      doc.asset!.width,
      doc.asset!.height,
    );
    // The draft preview was cleared while the pointer was still down.
    setPreview(null);
    if (!verdict.ok) {
      error.value = verdict.reason;
      notice.value = error.value;
      if (fallback) {
        doc.crop = cropWithCorners(doc.crop, fallback);
        invalidate();
      }
      return;
    }
    error.value = "";
    doc.crop = cropWithCorners(doc.crop, candidate);
    invalidate();
  }

  function cancel() {
    dragging.value = null;
    lastValid.value = null;
    draftCorners.value = null;
    rectStart.value = null;
    draftRect.value = null;
    error.value = "";
    setPreview(null);
  }

  function setMode(mode: "rect" | "quad") {
    cancel();
    if (mode === doc.crop.mode) return;
    doc.crop = cropWithMode(doc.crop, mode);
    invalidate();
  }

  function setRatio(ratio: Crop["ratio"]) {
    error.value = "";
    doc.crop = cropWithSettings(doc.crop, { ratio });
    invalidate();
  }

  function setSizing(sizing: Crop["sizing"]) {
    error.value = "";
    doc.crop = cropWithSettings(doc.crop, { sizing });
    invalidate();
  }

  function setLongEdge(longEdge: number) {
    error.value = "";
    doc.crop = cropWithSettings(doc.crop, { longEdge });
    invalidate();
  }

  function reset() {
    cancel();
    doc.crop = fullCrop();
    invalidate();
    notice.value = "已重置为原始矩形裁剪";
  }

  /**
   * Move one corner by a normalized delta. Used by keyboard users on a focused
   * handle; invalid moves are rejected with the same "keep last good" rule as
   * a pointer drag.
   */
  function nudge(index: number, dx: number, dy: number) {
    const asset = doc.asset;
    if (!asset) return;
    const next = cloneCorners(cornersOf(doc.crop));
    const corner = next[index]!;
    next[index] = {
      x: Math.max(0, Math.min(1, corner.x + dx)),
      y: Math.max(0, Math.min(1, corner.y + dy)),
    };
    const verdict = validateCorners(next, asset.width, asset.height);
    if (!verdict.ok) {
      error.value = verdict.reason;
      notice.value = `${verdict.reason}，已保留最后一份有效结果`;
      return;
    }
    error.value = "";
    // cropWithCorners commits in quad mode, so a keyboard nudge on a seeded
    // rectangle cleanly promotes the selection to four-corner mode.
    doc.crop = cropWithCorners(doc.crop, next);
    invalidate();
  }

  const previewCorners = computed<Corners>(() => {
    if (draftCorners.value) return draftCorners.value;
    return cornersOf(doc.crop);
  });

  /** Crop as it would be committed if the drag ended now (draft-aware). */
  const previewCrop = computed<Crop>(() => {
    if (draftCorners.value)
      return cropWithCorners(doc.crop, draftCorners.value);
    if (draftRect.value) return cropWithRect(doc.crop, draftRect.value);
    return doc.crop;
  });

  const previewRect = computed(() => {
    if (draftRect.value) return draftRect.value;
    return effectiveRect(doc.crop);
  });

  const displayMode = computed<"rect" | "quad">(() =>
    draftCorners.value ? "quad" : doc.crop.mode,
  );

  return {
    doc,
    active,
    displayMode,
    previewCorners,
    previewCrop,
    previewRect,
    error,
    down,
    move,
    up,
    cancel,
    setMode,
    setRatio,
    setSizing,
    setLongEdge,
    nudge,
    reset,
  };
}
