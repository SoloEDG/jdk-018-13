import { reactive, ref, shallowRef, provide, watch } from "vue";
import { createDocument } from "../shared/defaults";
import { studioKey } from "../shared/context";
import { generate } from "../features/mapping";
import type { Crop, Grid } from "../shared/document";

const PREVIEW_INTERVAL = 90;

export function useWorkspace() {
  const doc = reactive(createDocument());
  const busy = ref(false),
    notice = ref("所有处理均在你的浏览器中完成");
  const previewing = ref(false);
  const previewGrid = shallowRef<Grid | null>(null);
  let timer: ReturnType<typeof setTimeout>;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPreviewAt = 0;

  function invalidate() {
    doc.revision++;
    busy.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        doc.grid = generate(doc);
      } catch (e) {
        notice.value = e instanceof Error ? e.message : "生成失败";
      } finally {
        // The committed full-quality grid supersedes any drag draft.
        busy.value = false;
        previewing.value = false;
        previewGrid.value = null;
      }
    }, 60);
  }

  /**
   * Low-fidelity live preview while a corner is being dragged. Geometry is
   * identical to the committed result (the exact homography is always used);
   * only the sampling copy is smaller. Never writes `doc.grid`, so an invalid
   * or rejected drag cannot publish a torn frame.
   */
  function setPreview(crop: Crop | null) {
    previewing.value = !!crop;
    if (!crop) {
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = null;
      previewGrid.value = null;
      return;
    }
    const elapsed = Date.now() - lastPreviewAt;
    if (previewTimer) clearTimeout(previewTimer);
    const wait = Math.max(0, PREVIEW_INTERVAL - elapsed);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      lastPreviewAt = Date.now();
      try {
        previewGrid.value = generate(
          { ...doc, crop, grid: null },
          { quality: "draft" },
        );
      } catch {
        previewGrid.value = null;
      }
    }, wait);
  }

  // Background fills pixels outside the quad (and shows through padding), so
  // it is part of the generated content.
  watch(() => doc.settings.background, invalidate);
  provide(studioKey, {
    doc,
    busy,
    notice,
    invalidate,
    previewing,
    previewGrid,
    setPreview,
  });
  return { doc, busy, notice };
}
