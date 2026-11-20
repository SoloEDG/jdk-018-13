<script setup lang="ts">
import { computed } from "vue";
import type { Asset, Point } from "../../../shared/document";
import type { Corners } from "../lib/geometry";

const props = defineProps<{
  asset: Asset;
  mode: "rect" | "quad";
  corners: Corners;
  rect: { x: number; y: number; width: number; height: number };
  invalid: boolean;
  active: boolean;
}>();
const emit = defineEmits<{ nudge: [index: number, dx: number, dy: number] }>();

const points = computed(() =>
  props.corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" "),
);
const handleLabels = ["左上", "右上", "右下", "左下"];
function pct(p: Point) {
  return { left: p.x * 100 + "%", top: p.y * 100 + "%" };
}
function key(index: number, e: KeyboardEvent) {
  const step = e.shiftKey ? 0.02 : 0.002;
  switch (e.key) {
    case "ArrowLeft":
      emit("nudge", index, -step, 0);
      break;
    case "ArrowRight":
      emit("nudge", index, step, 0);
      break;
    case "ArrowUp":
      emit("nudge", index, 0, -step);
      break;
    case "ArrowDown":
      emit("nudge", index, 0, step);
      break;
    default:
      return;
  }
  e.preventDefault();
}
const rectBox = computed(() => ({
  left: props.rect.x * 100 + "%",
  top: props.rect.y * 100 + "%",
  width: props.rect.width * 100 + "%",
  height: props.rect.height * 100 + "%",
}));
</script>

<template>
  <div
    class="crop-image"
    :class="{ 'is-invalid': invalid, 'is-active': active }"
    :data-mode="mode"
  >
    <div class="crop-clip">
      <img :src="asset.url" :alt="asset.name" draggable="false" />
      <svg
        class="crop-quad"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="crop-dim-mask">
            <rect x="-50" y="-50" width="200" height="200" fill="white" />
            <polygon v-if="mode === 'quad'" :points="points" fill="black" />
            <rect
              v-else
              :x="rect.x * 100"
              :y="rect.y * 100"
              :width="rect.width * 100"
              :height="rect.height * 100"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="-50"
          y="-50"
          width="200"
          height="200"
          class="crop-dim"
          mask="url(#crop-dim-mask)"
        />
        <template v-if="mode === 'quad'">
          <polygon :points="points" class="crop-quad-line" />
          <line
            :x1="corners[0].x * 100"
            :y1="corners[0].y * 100"
            :x2="corners[2].x * 100"
            :y2="corners[2].y * 100"
            class="crop-quad-diag"
          />
          <line
            :x1="corners[1].x * 100"
            :y1="corners[1].y * 100"
            :x2="corners[3].x * 100"
            :y2="corners[3].y * 100"
            class="crop-quad-diag"
          />
        </template>
        <rect
          v-else
          :x="rect.x * 100"
          :y="rect.y * 100"
          :width="rect.width * 100"
          :height="rect.height * 100"
          class="crop-quad-line"
        />
      </svg>
    </div>
    <template v-if="mode === 'quad'">
      <span
        v-for="(corner, index) in corners"
        :key="index"
        class="crop-handle"
        :class="'handle-' + index"
        :style="pct(corner)"
        role="button"
        tabindex="0"
        :aria-label="'角点 ' + handleLabels[index]"
        @keydown="key(index, $event)"
      >
        <i />
      </span>
    </template>
    <div v-if="mode === 'rect'" class="crop-box" :style="rectBox">
      <i /><i /><i /><i />
    </div>
  </div>
</template>
