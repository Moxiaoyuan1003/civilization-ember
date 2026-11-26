<script setup lang="ts">
/**
 * 载体卡片（CarrierCard）—— 卡片视图。
 *
 * 交互（双模式 A 方案）：
 * - 单击卡片 → 右侧窄栏快速预览（selectCarrier）。
 * - 双击卡片 → 进入独立详情页 /carrier/:id（细看封面/作者等）。
 * - 底部"打开"按钮 → 直接进入阅读器/播放器（快捷入口）。
 *
 * 封面用 CarrierCover：有图显示图，无图用"类型图标+标题"占位封面。
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import type { Carrier } from '@shared/types/carrier'
import { carrierTypeMeta } from './carrierMeta'
import CarrierCover from './CarrierCover.vue'
import { Star, BookOpen } from 'lucide-vue-next'

const props = defineProps<{ carrier: Carrier }>()

const router = useRouter()
const store = useLibraryStore()

const meta = computed(() => carrierTypeMeta(props.carrier.type))
const isFav = computed(() => store.favoriteIds.has(props.carrier.id))
const progress = computed(() => store.progressMap.get(props.carrier.id)?.percent ?? 0)
const showFav = computed(() => store.prefs.features.favorites)
const showProgress = computed(() => store.prefs.features.readingProgress)

/** 收藏星标点击（阻止冒泡，避免触发选中） */
function toggleFav(e: MouseEvent): void {
  e.stopPropagation()
  void store.toggleFavorite(props.carrier.id)
}

/** 进入独立详情页 */
function openDetail(): void {
  void router.push(`/carrier/${props.carrier.id}`)
}

/** 进入阅读器/播放器 */
function open(): void {
  const target = props.carrier.type === 'video' || props.carrier.type === 'audio'
    ? `/player/${props.carrier.id}`
    : `/reader/${props.carrier.id}`
  void router.push(target)
}
</script>

<template>
  <div
    class="card"
    :class="{ 'card--selected': store.selectedCarrierId === carrier.id }"
    @click="store.selectCarrier(carrier.id)"
    @dblclick="openDetail"
  >
    <!-- 封面 -->
    <div class="card__cover">
      <CarrierCover :carrier="carrier" />
      <button v-if="showFav" class="card__star" :class="{ 'card__star--on': isFav }" title="收藏/取消收藏" @click="toggleFav">
        <Star :size="15" :fill="isFav ? 'currentColor' : 'none'" />
      </button>
    </div>

    <!-- 类型 + 标题 -->
    <div class="card__head">
      <span class="card__type" :title="meta.label">
        <component :is="meta.icon" :size="15" />
      </span>
      <h3 class="card__title">{{ carrier.title }}</h3>
    </div>

    <!-- 作者 -->
    <p v-if="carrier.authors?.length" class="card__author">{{ carrier.authors.join('、') }}</p>

    <!-- 简介 -->
    <p v-if="carrier.description" class="card__desc">{{ carrier.description }}</p>

    <!-- 底部：标签 + 打开 -->
    <div class="card__footer">
      <div class="card__tags">
        <span v-for="t in carrier.tags.slice(0, 3)" :key="t" class="card__tag">{{ t }}</span>
      </div>
      <button class="card__open" title="进入阅读/播放" @click.stop="open">
        <BookOpen :size="14" />
      </button>
    </div>

    <!-- 进度条 -->
    <div v-if="showProgress && progress > 0" class="card__progress">
      <div class="card__progress-fill" :style="{ width: `${progress * 100}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
  overflow: hidden;
}

.card:hover {
  border-color: var(--border-strong);
  background: var(--bg-surface-hover);
}

.card--selected {
  border-color: var(--ember-500);
}

.card__cover {
  position: relative;
  height: 120px;
  margin: -12px -12px 0;
}

.card__star {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: inline-flex;
  backdrop-filter: blur(4px);
}

.card__star--on {
  color: #fbbf24;
}

.card__star:hover {
  background: rgba(0, 0, 0, 0.55);
}

.card__head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.card__type {
  display: inline-flex;
  align-items: center;
  color: var(--ember-400);
  flex-shrink: 0;
}

.card__title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__author {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}

.card__tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}

.card__open {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  flex-shrink: 0;
}

.card__open:hover {
  color: var(--ember-400);
  border-color: var(--ember-500);
}

.card__progress {
  height: 3px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.card__progress-fill {
  height: 100%;
  background: var(--ember-500);
}
</style>
