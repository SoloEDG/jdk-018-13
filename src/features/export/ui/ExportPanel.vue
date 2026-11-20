<script setup lang="ts">
import { computed } from "vue";
import { Download, Copy, ArrowUpRight } from "lucide-vue-next";
import { useStudio } from "../../../shared/useStudio";
import { useExport } from "../model/useExport";
import { cropLayout } from "../../crop";
const e = useExport();
const { doc } = useStudio();
const layout = computed(() =>
  doc.asset ? cropLayout(doc.crop, doc.asset) : null,
);
</script>
<template>
  <section class="export-bar">
    <div>
      <span class="eyebrow">READY TO SHARE</span>
      <h3>带走你的字符作品</h3>
      <small v-if="layout">
        <template v-if="doc.crop.mode === 'quad'">
          四角校正 {{ layout.width }} × {{ layout.height }} px ·
          {{ layout.ratioLabel }}；导出采用完整变换，不使用降质拖动预览。
        </template>
        <template v-else>
          矩形裁剪 {{ layout.width }} × {{ layout.height }} px；导出使用提交后的完整结果。
        </template>
      </small>
      <small v-else>文本保留完整字符布局，PNG 保留当前配色。</small>
    </div>
    <div class="export-actions">
      <button
        class="secondary"
        :disabled="!e.ready() || e.exporting.value"
        @click="e.copy"
      >
        <Copy :size="15" /> 复制字符</button
      ><button
        class="secondary"
        :disabled="!e.ready() || e.exporting.value"
        @click="e.png"
      >
        PNG <ArrowUpRight :size="15" /></button
      ><button
        class="primary"
        :disabled="!e.ready() || e.exporting.value"
        @click="e.saveText"
      >
        <Download :size="16" /> 导出 .TXT
      </button>
    </div>
  </section>
</template>
