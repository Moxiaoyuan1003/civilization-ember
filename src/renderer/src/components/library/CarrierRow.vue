<script setup lang="ts">
/**
 * 载体行（CarrierRow）—— 列表视图。
 *
 * 与 CarrierCard 共用同一数据（同 store），只换"形态"。
 * 这是"双模式可插拔"的体现：数据层一致，视图层二选一。
 * 双击进入独立详情页 /carrier/:id。
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import type { Carrier } from '@/types/carrier'
import { carrierTypeMeta } from './carrierMeta'
import CarrierCover from './CarrierCover.vue'
import { Star } from 'lucide-vue-next'

const props = defineProps<{ carrier: Carrier }>()

const router = useRouter()
const store = useLibraryStore()

const meta = computed(() => carrierTypeMeta(props.carrier.type))
const isFav = computed(() => store.favoriteIds.has(props.carrier.id))
const progress = computed(() => store.progressMap.get(props.carrier.id)?.percent ?? 0)
const showFav = computed(() => store.prefs.features.favorites)
const showProgress = computed(() => store.prefs.features.readingProgress)

/** 格式化大小 */
const sizeLabel = computed(() => {
  const b = props.carrier.sizeBytes
  if (b == null) return ''
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
})

function toggleFav(e: MouseEvent): void {
  e.stopPropagation()
  void store.toggleFavorite(props.carrier.id)
}

function openDetail(): void {
  void router.push(`/carrier/${props.carrier.id}`)
}
</script>

<template>
  <div class="row" :class="{ 'row--selected': store.selectedCarrierId === carrier.id }" @click="store.selectCarrier(carrier.id)" @dblclick="openDetail">
    <!-- 封面缩略图 -->
    <div class="row__cover">
      <CarrierCover :carrier="carrier" />
    </div>

    <!-- 类型 + 标题/作者 -->
    <span class="row__type" :title="meta.label">
      <component :is="meta.icon" :size="16" />
    </span>

    <div class="row__main">
      <span class="row__title">{{ carrier.title }}</span>
      <span v-if="carrier.authors?.length" class="row__author">{{ carrier.authors.join('、') }}</span>
    </div>

    <div class="row__tags">
      <span v-for="t in carrier.tags.slice(0, 2)" :key="t" class="row__tag">{{ t }}</span>
    </div>

    <span class="row__size">{{ sizeLabel }}</span>

    <div v-if="showProgress" class="row__progress" :title="`进度 ${Math.round(progress * 100)}%`">
      <div class="row__progress-fill" :style="{ width: `${progress * 100}%` }"></div>
    </div>

    <button v-if="showFav" class="row__star" :class="{ 'row__star--on': isFav }" title="收藏" @click="toggleFav">
      <Star :size="15" :fill="isFav ? 'currentColor' : 'none'" />
    </button>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.row:hover {
  border-color: var(--border-strong);
  background: var(--bg-surface-hover);
}

.row--selected {
  border-color: var(--ember-500);
}

.row__cover {
  width: 44px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
}

.row__type {
  color: var(--ember-400);
  flex-shrink: 0;
  display: inline-flex;
}

.row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row__title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__author {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.row__tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 4px;
  padding: 1px 6px;
}

.row__size {
  font-size: 12px;
  color: var(--text-muted);
  width: 64px;
  text-align: right;
  flex-shrink: 0;
}

.row__progress {
  width: 80px;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.row__progress-fill {
  height: 100%;
  background: var(--ember-500);
}

.row__star {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  flex-shrink: 0;
}

.row__star--on {
  color: var(--ember-400);
}

.row__star:hover {
  background: var(--bg-elevated);
}
</style>
