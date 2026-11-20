import { ref, computed } from "vue";
import { useStudio } from "../../../shared/useStudio";
export function usePreview() {
  const { doc, busy, previewing, previewGrid } = useStudio();
  const mode = ref<"art" | "text">("art");
  const zoom = ref(100);
  // While a corner is being dragged the draft frame is shown, but export and
  // status remain tied to the committed full-quality grid.
  const shown = computed(() => previewGrid.value ?? doc.grid);
  const count = computed(() => shown.value?.cells.length.toLocaleString() ?? "0");
  const drafting = computed(() => previewing.value && !!previewGrid.value);
  return { doc, busy, mode, zoom, count, shown, drafting };
}
