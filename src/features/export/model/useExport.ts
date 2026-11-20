import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { generate } from "../../mapping";
import { textContent } from "../lib/text";
import { download, exportName } from "../lib/download";
import { drawGrid } from "../../preview";

export function useExport() {
  const { doc, notice, busy } = useStudio();
  const exporting = ref(false);

  function ready() {
    return !!doc.grid && doc.grid.revision === doc.revision && !busy.value;
  }

  /**
   * Export must never use the low-fidelity drag preview. Force one synchronous
   * full-quality generate from the committed crop, then hand out that grid.
   */
  async function fullGrid() {
    if (!doc.asset || exporting.value) return null;
    exporting.value = true;
    try {
      const grid = generate(doc);
      if (!grid) return null;
      doc.grid = grid;
      return grid;
    } catch (e) {
      notice.value = e instanceof Error ? e.message : "生成失败";
      return null;
    } finally {
      exporting.value = false;
    }
  }

  async function saveText() {
    const grid = await fullGrid();
    if (!grid) return;
    download(
      new Blob([textContent(grid)], { type: "text/plain;charset=utf-8" }),
      exportName(doc.asset?.name ?? "art", "txt"),
    );
    notice.value = "文本已导出（完整校正）";
  }

  async function copy() {
    const grid = await fullGrid();
    if (!grid) return;
    try {
      await navigator.clipboard.writeText(textContent(grid));
      notice.value = "字符画已复制（完整校正）";
    } catch {
      notice.value = "无法访问剪贴板，请使用文本导出";
    }
  }

  async function png() {
    const grid = await fullGrid();
    if (!grid) return;
    const c = document.createElement("canvas");
    drawGrid(c, grid, doc.settings.color, doc.settings.background);
    c.toBlob((b) => {
      if (b) download(b, exportName(doc.asset?.name ?? "art", "png"));
    }, "image/png");
    notice.value = "PNG 已导出（完整校正）";
  }

  return { doc, busy, exporting, ready, saveText, copy, png };
}
