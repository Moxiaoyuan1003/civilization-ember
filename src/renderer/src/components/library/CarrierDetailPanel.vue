<script setup lang="ts">
/**
 * 载体详情面板（CarrierDetailPanel）。
 *
 * 展示选中载体的完整信息：
 * - 标题行（类型图标 + 名称 + 收藏 + 关闭）。
 * - 元信息（作者 / 格式 / 大小 / 时长 / 摄取状态）。
 * - 简介。
 * - 标签。
 * - 反向链接（被哪些技术树节点引用，可点击跳技术树）。
 * - 操作（进入阅读/播放、重新摄取、写标注）。
 *
 * 数据层与形态解耦：本组件只消费 store；形态（右侧栏/抽屉）由页面按偏好切换。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import type { Carrier } from '@shared/types/carrier'
import { carrierTypeMeta } from './carrierMeta'
import CarrierCover from './CarrierCover.vue'
import { X, Star, BookOpen, Play, RefreshCw, PenLine, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{ carrier: Carrier }>()

const router = useRouter()
const store = useLibraryStore()
const { prefs } = storeToRefs(store)

const meta = computed(() => carrierTypeMeta(props.carrier.type))
const isFav = computed(() => store.favoriteIds.has(props.carrier.id))
const progress = computed(() => store.progressMap.get(props.carrier.id)?.percent ?? 0)
const citing = computed(() => store.nodesCiting(props.carrier.id))
const showFav = computed(() => prefs.value.features.favorites)
const showAnnotations = computed(() => prefs.value.features.annotations)

/** 格式化大小 */
const sizeLabel = computed(() => {
  const b = props.carrier.sizeBytes
  if (b == null) return '—'
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
})

/** 格式化时长 */
const durationLabel = computed(() => {
  const s = props.carrier.durationSec
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m} 分 ${sec} 秒`
})

/** 是否音视频（决定进入阅读器还是播放器） */
const isAV = computed(() => props.carrier.type === 'video' || props.carrier.type === 'audio')

function toggleFav(): void {
  void store.toggleFavorite(props.carrier.id)
}

function open(): void {
  const target = isAV.value ? `/player/${props.carrier.id}` : `/reader/${props.carrier.id}`
  void router.push(target)
}

function goNode(nodeId: string): void {
  void router.push({ path: '/tech-tree', query: { nodeId } })
}

/** 进入独立详情页（大版面） */
function openDetail(): void {
  void router.push(`/carrier/${props.carrier.id}`)
}

function reIngest(): void {
  // 第 6 期接管理页摄取队列；当前仅占位提示
  window.alert('重新摄取将在第 6 期（管理页）接入摄取队列')
}
</script>

<template>
  <aside class="cdetail">
    <!-- 标题行 -->
    <header class="cdetail__header">
      <div class="cdetail__title">
        <span class="cdetail__type">
          <component :is="meta.icon" :size="16" />
        </span>
        <h2 class="cdetail__name">{{ carrier.title }}</h2>
      </div>
      <div class="cdetail__head-actions">
        <button v-if="showFav" class="cdetail__icon-btn" :class="{ 'cdetail__icon-btn--on': isFav }" title="收藏" @click="toggleFav">
          <Star :size="16" :fill="isFav ? 'currentColor' : 'none'" />
        </button>
        <button class="cdetail__icon-btn" title="关闭详情" @click="store.selectCarrier(null)">
          <X :size="16" />
        </button>
      </div>
    </header>

    <!-- 封面 -->
    <div class="cdetail__cover">
      <CarrierCover :carrier="carrier" />
    </div>

    <!-- 元信息 -->
    <dl class="cdetail__meta">
      <div class="cdetail__meta-item">
        <dt>类型</dt>
        <dd>{{ meta.label }}（{{ carrier.format ?? '未知' }}）</dd>
      </div>
      <div v-if="carrier.authors?.length" class="cdetail__meta-item">
        <dt>作者</dt>
        <dd>{{ carrier.authors.join('、') }}</dd>
      </div>
      <div class="cdetail__meta-item">
        <dt>大小</dt>
        <dd>{{ sizeLabel }}</dd>
      </div>
      <div v-if="carrier.durationSec != null" class="cdetail__meta-item">
        <dt>时长</dt>
        <dd>{{ durationLabel }}</dd>
      </div>
      <div class="cdetail__meta-item">
        <dt>状态</dt>
        <dd>{{ carrier.status }}</dd>
      </div>
    </dl>

    <!-- 简介 -->
    <p v-if="carrier.description" class="cdetail__desc">{{ carrier.description }}</p>

    <!-- 标签 -->
    <div v-if="carrier.tags.length" class="cdetail__tags">
      <span v-for="t in carrier.tags" :key="t" class="cdetail__tag">{{ t }}</span>
    </div>

    <!-- 进度 -->
    <div v-if="prefs.features.readingProgress" class="cdetail__progress">
      <span class="cdetail__progress-label">阅读进度 {{ Math.round(progress * 100) }}%</span>
      <div class="cdetail__progress-track">
        <div class="cdetail__progress-fill" :style="{ width: `${progress * 100}%` }"></div>
      </div>
    </div>

    <!-- 反向链接 -->
    <section v-if="citing.length" class="cdetail__section">
      <h3 class="cdetail__section-title">被这些技术树节点引用</h3>
      <ul class="cdetail__list">
        <li
          v-for="n in citing"
          :key="n.id"
          class="cdetail__item"
          @click="goNode(n.id)"
        >
          <span class="cdetail__dot" :style="{ background: `var(--layer-${n.layer})` }"></span>
          <span class="cdetail__item-name">{{ n.name }}</span>
          <span class="cdetail__item-layer">L{{ n.layer }}</span>
        </li>
      </ul>
    </section>

    <!-- 操作 -->
    <footer class="cdetail__actions">
      <button class="cdetail__action cdetail__action--primary" @click="open">
        <Play v-if="isAV" :size="14" />
        <BookOpen v-else :size="14" />
        <span>{{ isAV ? '播放' : '阅读' }}</span>
      </button>
      <button class="cdetail__action" title="进入详情页" @click="openDetail">
        <ExternalLink :size="14" />
        <span>详情</span>
      </button>
      <button class="cdetail__action" @click="reIngest">
        <RefreshCw :size="14" />
        <span>重新摄取</span>
      </button>
      <button v-if="showAnnotations" class="cdetail__action" @click="reIngest">
        <PenLine :size="14" />
        <span>标注</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.cdetail {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 14px 16px;
  gap: 12px;
}

.cdetail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.cdetail__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cdetail__type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-elevated);
  color: var(--ember-400);
  flex-shrink: 0;
}

.cdetail__name {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}

.cdetail__head-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.cdetail__cover {
  height: 160px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.cdetail__icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
}

.cdetail__icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.cdetail__icon-btn--on {
  color: var(--ember-400);
}

.cdetail__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 0;
}

.cdetail__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cdetail__meta-item dt {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cdetail__meta-item dd {
  font-size: 13px;
  color: var(--text-primary);
  margin: 0;
}

.cdetail__desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.cdetail__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cdetail__tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 4px;
  padding: 2px 8px;
}

.cdetail__progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cdetail__progress-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.cdetail__progress-track {
  height: 5px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.cdetail__progress-fill {
  height: 100%;
  background: var(--ember-500);
}

.cdetail__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cdetail__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.cdetail__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cdetail__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
}

.cdetail__item:hover {
  background: var(--bg-surface-hover);
}

.cdetail__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cdetail__item-name {
  color: var(--text-primary);
}

.cdetail__item-layer {
  color: var(--text-muted);
  font-size: 12px;
  margin-left: auto;
}

.cdetail__actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.cdetail__action {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.cdetail__action:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.cdetail__action--primary {
  border-color: var(--ember-500);
  color: var(--ember-400);
}
</style>
