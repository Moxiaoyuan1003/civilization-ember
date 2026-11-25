<script setup lang="ts">
/**
 * 载体详情页（CarrierDetailPage）—— 独立全屏详情页，路由 /carrier/:id。
 *
 * 与右侧窄栏（CarrierDetailPanel）是"双模式"的两种形态：
 * - 窄栏：图书馆页右侧快速预览。
 * - 本页：大版面细看（封面 + 作者 + 简介 + 标签 + 进度 + 反向链接 + 操作）。
 *
 * 数据全部来自图书馆 store；从图书馆/搜索/技术树跳转时带 :id。
 */

import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import CarrierCover from '@/components/library/CarrierCover.vue'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import { ArrowLeft, Star, BookOpen, Play, RefreshCw, PenLine } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const { prefs, favoriteIds, progressMap } = storeToRefs(store)

const carrier = computed(() => {
  const id = route.params.id as string
  return store.carrierMap.get(id) ?? null
})

const meta = computed(() => (carrier.value ? carrierTypeMeta(carrier.value.type) : null))
const isFav = computed(() => (carrier.value ? favoriteIds.value.has(carrier.value.id) : false))
const progress = computed(() =>
  carrier.value ? progressMap.value.get(carrier.value.id)?.percent ?? 0 : 0
)
const citing = computed(() => (carrier.value ? store.nodesCiting(carrier.value.id) : []))
const isAV = computed(() => carrier.value?.type === 'video' || carrier.value?.type === 'audio')

const sizeLabel = computed(() => {
  const b = carrier.value?.sizeBytes
  if (b == null) return '—'
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
})

const durationLabel = computed(() => {
  const s = carrier.value?.durationSec
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m} 分 ${sec} 秒`
})

onMounted(async () => {
  if (!store.carriers.length) await store.load()
})

// 路由 id 变化时无需重载（carrierMap 派生），仅用于保证数据就绪
watch(
  () => route.params.id,
  async () => {
    if (!store.carriers.length) await store.load()
  }
)

function goBack(): void {
  void router.back()
}

function toggleFav(): void {
  if (carrier.value) void store.toggleFavorite(carrier.value.id)
}

function open(): void {
  if (!carrier.value) return
  const target = isAV.value ? `/player/${carrier.value.id}` : `/reader/${carrier.value.id}`
  void router.push(target)
}

function goNode(nodeId: string): void {
  void router.push({ path: '/tech-tree', query: { nodeId } })
}

function reIngest(): void {
  window.alert('重新摄取将在第 6 期（管理页）接入摄取队列')
}
</script>

<template>
  <div class="cdpage">
    <!-- 顶栏 -->
    <header class="cdpage__bar">
      <button class="cdpage__back" title="返回" @click="goBack">
        <ArrowLeft :size="16" />
      </button>
      <span class="cdpage__bar-title">载体详情</span>
    </header>

    <!-- 空态 / 未找到 -->
    <div v-if="!carrier" class="cdpage__state">未找到该载体</div>

    <!-- 主体 -->
    <div v-else class="cdpage__body">
      <!-- 左：封面 -->
      <div class="cdpage__cover">
        <CarrierCover :carrier="carrier" />
      </div>

      <!-- 右：信息 -->
      <div class="cdpage__info">
        <!-- 标题行 -->
        <div class="cdpage__title-row">
          <h1 class="cdpage__title">{{ carrier.title }}</h1>
          <button
            v-if="prefs.features.favorites"
            class="cdpage__star"
            :class="{ 'cdpage__star--on': isFav }"
            title="收藏"
            @click="toggleFav"
          >
            <Star :size="18" :fill="isFav ? 'currentColor' : 'none'" />
          </button>
        </div>

        <!-- 元信息 -->
        <dl class="cdpage__meta">
          <div class="cdpage__meta-item">
            <dt>类型</dt>
            <dd>{{ meta?.label ?? '—' }}（{{ carrier.format ?? '未知' }}）</dd>
          </div>
          <div v-if="carrier.authors?.length" class="cdpage__meta-item">
            <dt>作者</dt>
            <dd>{{ carrier.authors.join('、') }}</dd>
          </div>
          <div class="cdpage__meta-item">
            <dt>大小</dt>
            <dd>{{ sizeLabel }}</dd>
          </div>
          <div v-if="carrier.durationSec != null" class="cdpage__meta-item">
            <dt>时长</dt>
            <dd>{{ durationLabel }}</dd>
          </div>
          <div class="cdpage__meta-item">
            <dt>状态</dt>
            <dd>{{ carrier.status }}</dd>
          </div>
          <div class="cdpage__meta-item">
            <dt>入库时间</dt>
            <dd>{{ carrier.createdAt.slice(0, 10) }}</dd>
          </div>
        </dl>

        <!-- 简介 -->
        <p v-if="carrier.description" class="cdpage__desc">{{ carrier.description }}</p>

        <!-- 标签 -->
        <div v-if="carrier.tags.length" class="cdpage__tags">
          <span v-for="t in carrier.tags" :key="t" class="cdpage__tag">{{ t }}</span>
        </div>

        <!-- 进度 -->
        <div v-if="prefs.features.readingProgress" class="cdpage__progress">
          <span class="cdpage__progress-label">阅读进度 {{ Math.round(progress * 100) }}%</span>
          <div class="cdpage__progress-track">
            <div class="cdpage__progress-fill" :style="{ width: `${progress * 100}%` }"></div>
          </div>
        </div>

        <!-- 反向链接 -->
        <section v-if="citing.length" class="cdpage__section">
          <h2 class="cdpage__section-title">被这些技术树节点引用</h2>
          <ul class="cdpage__list">
            <li v-for="n in citing" :key="n.id" class="cdpage__item" @click="goNode(n.id)">
              <span class="cdpage__dot" :style="{ background: `var(--layer-${n.layer})` }"></span>
              <span class="cdpage__item-name">{{ n.name }}</span>
              <span class="cdpage__item-layer">L{{ n.layer }}</span>
            </li>
          </ul>
        </section>

        <!-- 操作 -->
        <footer class="cdpage__actions">
          <button class="cdpage__action cdpage__action--primary" @click="open">
            <Play v-if="isAV" :size="15" />
            <BookOpen v-else :size="15" />
            <span>{{ isAV ? '开始播放' : '开始阅读' }}</span>
          </button>
          <button class="cdpage__action" @click="reIngest">
            <RefreshCw :size="15" />
            <span>重新摄取</span>
          </button>
          <button v-if="prefs.features.annotations" class="cdpage__action" @click="reIngest">
            <PenLine :size="15" />
            <span>标注</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cdpage {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
}

.cdpage__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.cdpage__back {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.cdpage__back:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.cdpage__bar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.cdpage__state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.cdpage__body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  gap: 28px;
  padding: 24px 28px;
}

.cdpage__cover {
  width: 260px;
  flex-shrink: 0;
  height: 360px;
}

.cdpage__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
}

.cdpage__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cdpage__title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}

.cdpage__star {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  flex-shrink: 0;
}

.cdpage__star--on {
  color: var(--ember-400);
}

.cdpage__star:hover {
  background: var(--bg-elevated);
}

.cdpage__meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 20px;
  margin: 0;
}

.cdpage__meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cdpage__meta-item dt {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cdpage__meta-item dd {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0;
}

.cdpage__desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}

.cdpage__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cdpage__tag {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 5px;
  padding: 3px 10px;
}

.cdpage__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cdpage__progress-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.cdpage__progress-track {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.cdpage__progress-fill {
  height: 100%;
  background: var(--ember-500);
}

.cdpage__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cdpage__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.cdpage__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cdpage__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 7px 12px;
  border-radius: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.cdpage__item:hover {
  border-color: var(--border-strong);
  background: var(--bg-surface-hover);
}

.cdpage__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cdpage__item-name {
  color: var(--text-primary);
}

.cdpage__item-layer {
  color: var(--text-muted);
  font-size: 12px;
}

.cdpage__actions {
  display: flex;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.cdpage__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.cdpage__action:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.cdpage__action--primary {
  border-color: var(--ember-500);
  color: var(--ember-400);
}
</style>
