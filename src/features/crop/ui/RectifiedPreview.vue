<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { Crop } from "../../../shared/document";
import { useStudio } from "../../../shared/useStudio";
import { effectiveRect, validateCorners, type Corners } from "../lib/geometry";
import { cropLayout } from "../lib/output";
import { warpPlane } from "../lib/warp";

const props = defineProps<{ crop: Crop; corners: Corners }>();
const { doc } = useStudio();
const canvas = ref<HTMLCanvasElement>();
const MAX_EDGE = 280;

function draw() {
  const asset = doc.asset;
  const target = canvas.value;
  if (!asset || !target) return;
  // During a drag the corners can be transiently invalid. Keep the previous
  // good frame on screen instead of rendering a mirrored/torn preview.
  if (
    props.crop.mode === "quad" &&
    !validateCorners(props.corners, asset.width, asset.height).ok
  )
    return;
  const layout = cropLayout(props.crop, asset);
  const aspect = Math.max(0.05, layout.width / layout.height);
  const width = aspect >= 1 ? MAX_EDGE : Math.round(MAX_EDGE * aspect);
  const height = aspect >= 1 ? Math.round(MAX_EDGE / aspect) : MAX_EDGE;
  target.width = width;
  target.height = height;
  const context = target.getContext("2d")!;
  context.fillStyle = "#0c0e12";
  context.fillRect(0, 0, width, height);
  if (props.crop.mode === "quad") {
    // Same projective transform as the full pipeline, just a smaller raster.
    const warped = warpPlane(asset, props.corners, width, height, {
      sourceLongEdge: 900,
      background: "#0c0e12",
    });
    context.drawImage(warped, 0, 0);
  } else {
    const rect = effectiveRect(props.crop);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      asset.image,
      rect.x * asset.width,
      rect.y * asset.height,
      rect.width * asset.width,
      rect.height * asset.height,
      0,
      0,
      width,
      height,
    );
  }
}

onMounted(draw);
watch(() => [props.crop, props.corners], draw, { deep: true });
</script>
<template>
  <div class="rectified-preview">
    <div class="rectified-label">
      <span>校正后画面</span><span class="mono">{{ doc.crop.mode === "quad" ? "PERSPECTIVE" : "RECT" }}</span>
    </div>
    <canvas ref="canvas" aria-label="校正后画面预览" />
  </div>
</template>
