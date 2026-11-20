import type { StudioDocument, Grid } from "../../../shared/document";
import { validateCorners } from "../../crop/lib/geometry";
import { glyphs } from "../lib/charsets";
import { gridSize } from "../lib/gridSize";
import {
  cropSource,
  DRAFT_RECTIFY_EDGE,
  FULL_RECTIFY_EDGE,
} from "../lib/rectify";
import { sample } from "../lib/sample";
import { tone, luminance } from "../lib/tone";

export interface GenerateOptions {
  /**
   * Sampling fidelity. Drags use `draft` (smaller source copy, same exact
   * geometry); commit, confirm and export always use `full`.
   */
  quality?: "draft" | "full";
}

export function generate(
  doc: StudioDocument,
  options: GenerateOptions = {},
): Grid | null {
  if (!doc.asset) return null;
  const s = doc.settings;
  if (doc.crop.mode === "quad") {
    // Defence in depth: an invalid quad must never reach sampling, no matter
    // which caller produced it.
    const verdict = validateCorners(
      doc.crop.corners,
      doc.asset.width,
      doc.asset.height,
    );
    if (!verdict.ok) throw new Error(verdict.reason);
  }
  const quality = options.quality ?? "full";
  const source = cropSource(doc.asset, doc.crop, {
    rectifyEdge: quality === "draft" ? DRAFT_RECTIFY_EDGE : FULL_RECTIFY_EDGE,
  });
  const size = gridSize(source.aspect, s.columns);
  const { pixels } = sample(
    doc.asset,
    doc.crop,
    size.columns,
    size.rows,
    s.background,
    { quality, source },
  );
  const chars = glyphs(s.charset, s.custom);
  const cells = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!,
      g = pixels[i + 1]!,
      b = pixels[i + 2]!;
    const t = tone(luminance(r, g, b), s.contrast, s.gamma, s.invert);
    cells.push({
      glyph: chars[Math.round(t * (chars.length - 1))]!,
      color:
        "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
    });
  }
  return { ...size, cells, revision: doc.revision };
}
