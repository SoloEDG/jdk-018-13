<script setup lang="ts">
import { computed, watch } from "vue";
import { Crop, RotateCcw, ScanLine, Square, TriangleAlert } from "lucide-vue-next";
import { useCrop } from "../model/useCrop";
import { cropLayout } from "../lib/output";
import { RATIOS } from "../lib/geometry";
import CropImage from "./CropImage.vue";
import RectifiedPreview from "./RectifiedPreview.vue";

const c = useCrop();
const layout = computed(() =>
  c.doc.asset
    ? cropLayout(
        // Invalid drags are rejected on release, so keep showing the last
        // committed geometry instead of a torn one.
        c.error.value ? c.doc.crop : c.previewCrop.value,
        c.doc.asset,
      )
    : null,
);
const quad = computed(() => c.doc.crop.mode === "quad");

watch(
  () => c.doc.asset,
  () => c.cancel(),
);
</script>
<template>
  <section class="panel">
    <div class="section-title"><span>02 / CROP</span><Crop :size="15" /></div>
    <div class="mode-switch" role="group" aria-label="裁剪模式">
      <button
        :class="{ active: c.displayMode.value === 'rect' }"
        aria-label="矩形裁剪"
        @click="c.setMode('rect')"
      >
        <Square :size="12" /> 矩形
      </button>
      <button
        :class="{ active: c.displayMode.value === 'quad' }"
        aria-label="四角校正"
        @click="c.setMode('quad')"
      >
        <ScanLine :size="12" /> 四角校正
      </button>
    </div>
    <div class="hint-line">
      {{
        quad
          ? "拖动四个圆点贴合画面四角，透视会被拉直"
          : "拖动框选转换区域（快捷矩形入口）"
      }}
    </div>
    <div
      v-if="c.doc.asset"
      class="crop-interaction"
      @pointerdown="c.down"
      @pointermove="c.move"
      @pointerup="c.up"
      @pointercancel="c.cancel"
    >
      <CropImage
        :asset="c.doc.asset"
        :mode="c.displayMode.value"
        :corners="c.previewCorners.value"
        :rect="c.previewRect.value"
        :invalid="!!c.error.value"
        :active="c.active.value"
        @nudge="c.nudge"
      />
    </div>
    <p v-if="c.error.value" class="crop-error" role="alert">
      <TriangleAlert :size="12" />
      <span>
        {{ c.error.value }}
        <template v-if="!c.active.value">· 已保留最后一次有效校正</template>
      </span>
    </p>
    <div class="hint">
      <span>{{
        c.error.value
          ? "拖动已取消，画面保持上一份有效校正"
          : quad
            ? "四角顺序正常 · 已应用透视变换"
            : "矩形裁剪保持图片原始比例"
      }}</span>
      <button class="icon-button" aria-label="重置裁剪" @click="c.reset">
        <RotateCcw :size="13" />
      </button>
    </div>
    <template v-if="quad && layout">
      <RectifiedPreview
        :crop="c.doc.crop"
        :corners="c.previewCorners.value"
      />
      <div class="quad-controls">
        <label class="field compact"
          >输出比例
          <select
            aria-label="输出比例"
            :value="c.doc.crop.ratio"
            @change="
              c.setRatio(
                ($event.target as HTMLSelectElement)
                  .value as typeof c.doc.crop.ratio,
              )
            "
          >
            <option v-for="r in RATIOS" :key="r.id" :value="r.id">
              {{ r.label }}
            </option>
          </select>
        </label>
        <label class="field compact"
          >尺寸
          <select
            aria-label="尺寸策略"
            :value="c.doc.crop.sizing"
            @change="
              c.setSizing(
                ($event.target as HTMLSelectElement)
                  .value as typeof c.doc.crop.sizing,
              )
            "
          >
            <option value="fixed">固定尺寸</option>
            <option value="auto">自动尺寸</option>
          </select>
        </label>
        <label v-if="c.doc.crop.sizing === 'fixed'" class="field compact wide"
          >长边
          <select
            aria-label="长边像素"
            :value="c.doc.crop.longEdge"
            @change="
              c.setLongEdge(Number(($event.target as HTMLSelectElement).value))
            "
          >
            <option :value="720">720 px</option>
            <option :value="1080">1080 px</option>
            <option :value="1440">1440 px</option>
            <option :value="1920">1920 px</option>
          </select>
        </label>
      </div>
      <dl class="crop-facts">
        <div>
          <dt>输出</dt>
          <dd class="mono">{{ layout.width }} × {{ layout.height }} px</dd>
        </div>
        <div>
          <dt>比例</dt>
          <dd>
            {{ layout.ratioLabel }}
            <span class="muted">
              <template v-if="c.doc.crop.ratio === 'auto'">
                {{
                  layout.estimate?.confidence === "low"
                    ? "· 接近正对，按投影边长估计"
                    : "· 透视推断"
                }}
              </template>
              <template v-else-if="layout.ratioForced">
                · 与透视推断不符，画面会被拉伸
              </template>
            </span>
          </dd>
        </div>
        <div>
          <dt>尺寸</dt>
          <dd>
            <template v-if="layout.autoSized">
              自动 · 取角点覆盖的源像素
            </template>
            <template v-else>固定 · 与拍摄角度无关</template>
          </dd>
        </div>
      </dl>
      <p class="crop-impact">
        <template v-if="layout.autoSized">
          极端斜拍时远边被压缩，自动尺寸随之降低长边，不会凭空补出细节；内容比例仍按校正后的画面。
        </template>
        <template v-else>
          极端斜拍时固定尺寸不会因远边压缩而降采样，但也不会增加真实细节；输出尺寸可复现。
        </template>
      </p>
    </template>
    <small v-else-if="layout" class="mono muted crop-meta">
      {{ Math.round(c.doc.crop.width * 100) }}% W ×
      {{ Math.round(c.doc.crop.height * 100) }}% H · {{ layout.width }} ×
      {{ layout.height }} px
      <br />矩形模式按原图比例采样；切到四角校正可消除透视
    </small>
  </section>
</template>
