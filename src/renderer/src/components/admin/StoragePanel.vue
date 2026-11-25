<script setup lang="ts">
/**
 * 存储占用面板（StoragePanel）。
 *
 * 显示：载体数 / 原文件总量 / 索引体积 / 去重节省 / 按类型明细（带条形占比）。
 *
 * 用在管理页右侧，是"存储管理"的可视化部分。
 * 真实实现时可在这里加"清理索引""迁移目录"等动作，接口已由 ingest service 预留。
 */

import { computed } from 'vue'
import { Database, FileArchive, Layers, Sparkles, HardDrive } from 'lucide-vue-next'
import type { StorageStats } from '@/types/ingest'
import { formatBytes } from '@/lib/format'

const props = defineProps<{ stats: StorageStats | null }>()

/** 总占用（原文件 + 索引） */
const totalBytes = computed(() =>
  props.stats ? props.stats.originalBytes + props.stats.indexBytes : 0
)

/** 每类占比（用于条形宽度） */
const byTypeWithRatio = computed(() => {
  const s = props.stats
  if (!s || s.originalBytes <= 0) return []
  return s.byType.map((t) => ({
    ...t,
    ratio: t.bytes / s.originalBytes
  }))
})
</script>

<template>
  <div class="storage">
    <div class="storage__head">
      <HardDrive :size="16" />
      <h3>存储占用</h3>
    </div>

    <div v-if="!stats" class="storage__empty">暂无数据</div>

    <template v-else>
      <!-- 四格汇总 -->
      <div class="storage__grid">
        <div class="storage__cell">
          <Layers :size="14" />
          <span class="storage__value">{{ stats.carrierCount }}</span>
          <span class="storage__label">个载体</span>
        </div>
        <div class="storage__cell">
          <Database :size="14" />
          <span class="storage__value">{{ formatBytes(totalBytes) }}</span>
          <span class="storage__label">总占用</span>
        </div>
        <div class="storage__cell">
          <FileArchive :size="14" />
          <span class="storage__value">{{ formatBytes(stats.indexBytes) }}</span>
          <span class="storage__label">索引</span>
        </div>
        <div class="storage__cell">
          <Sparkles :size="14" />
          <span class="storage__value">{{ formatBytes(stats.dedupSavedBytes) }}</span>
          <span class="storage__label">去重节省</span>
        </div>
      </div>

      <!-- 按类型明细 -->
      <div class="storage__section-title">按类型</div>
      <div class="storage__list">
        <div v-for="t in byTypeWithRatio" :key="t.type" class="storage__row">
          <span class="storage__row-label">{{ t.label }}</span>
          <div class="storage__row-bar">
            <div class="storage__row-fill" :style="{ width: `${t.ratio * 100}%` }" />
          </div>
          <span class="storage__row-size">{{ formatBytes(t.bytes) }}</span>
          <span class="storage__row-count">{{ t.count }} 个</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.storage {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
}

.storage__head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.storage__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.storage__empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
  text-align: center;
}

.storage__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.storage__cell {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-elevated);
  border-radius: 8px;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.storage__value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.storage__label {
  font-size: 11px;
  color: var(--text-muted);
}

.storage__section-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.storage__list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.storage__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.storage__row-label {
  width: 32px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.storage__row-bar {
  flex: 1;
  height: 5px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.storage__row-fill {
  height: 100%;
  background: var(--ember-500);
  border-radius: 3px;
  opacity: 0.75;
}

.storage__row-size {
  width: 58px;
  text-align: right;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.storage__row-count {
  width: 40px;
  text-align: right;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
