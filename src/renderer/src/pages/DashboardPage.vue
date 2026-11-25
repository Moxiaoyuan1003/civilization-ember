<script setup lang="ts">
/**
 * 首页 Dashboard：总览舱（第 5 期实现）。
 *
 * 结构：
 * - 顶栏：全局搜索框（载体/技术节点/对话）+ 问候语。
 * - 主体：卡片网格（6 张可拖拽重排、可独立隐藏的卡片）。
 *
 * 卡片拖拽重排：用原生 HTML5 drag & drop，拖动改变顺序后
 * 落到个人偏好 dashboard.cardOrder（store.reorderCards 持久化）。
 * 卡片显隐：每张卡右上角"隐藏"按钮 → store.toggleCard。
 */

import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore, DASHBOARD_CARDS, type DashboardCardId } from '@/stores/dashboard'
import GlobalSearchBar from '@/components/dashboard/GlobalSearchBar.vue'
import ProgressCard from '@/components/dashboard/ProgressCard.vue'
import GapsCard from '@/components/dashboard/GapsCard.vue'
import ContinueCard from '@/components/dashboard/ContinueCard.vue'
import IngestCard from '@/components/dashboard/IngestCard.vue'
import FavoritesCard from '@/components/dashboard/FavoritesCard.vue'
import QuickCard from '@/components/dashboard/QuickCard.vue'
import type { Component } from 'vue'

const store = useDashboardStore()
const { visibleCards, loading, error, user } = storeToRefs(store)

/** 卡片 id → 组件 */
const CARD_COMPONENT: Record<DashboardCardId, Component> = {
  progress: ProgressCard,
  gaps: GapsCard,
  continue: ContinueCard,
  ingest: IngestCard,
  favorites: FavoritesCard,
  quick: QuickCard
}

/** 拖拽状态 */
const draggingId = ref<DashboardCardId | null>(null)
const dragOverId = ref<DashboardCardId | null>(null)

onMounted(() => {
  void store.load()
})

/* ---------- 拖拽重排（HTML5 drag & drop） ---------- */

function onDragStart(id: DashboardCardId, e: DragEvent): void {
  draggingId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需要设置数据才能触发拖拽
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragOver(id: DashboardCardId, e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverId.value = id
}

function onDragLeave(): void {
  dragOverId.value = null
}

function onDrop(id: DashboardCardId, e: DragEvent): void {
  e.preventDefault()
  const from = draggingId.value
  const to = id
  draggingId.value = null
  dragOverId.value = null

  if (!from || from === to) return

  // 重排 visibleCards：把 from 移动到 to 的位置
  const order = [...visibleCards.value]
  const fromIdx = order.indexOf(from)
  const toIdx = order.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return
  order.splice(fromIdx, 1)
  order.splice(toIdx, 0, from)

  // 补全隐藏卡：cardOrder 存"完整顺序"，隐藏卡由 hiddenCards 控制
  const full = [...order]
  const hidden = new Set(store.prefs.dashboard.hiddenCards)
  for (const c of DASHBOARD_CARDS) {
    if (!full.includes(c) && !hidden.has(c)) full.push(c)
  }
  void store.reorderCards(full)
}

function onDragEnd(): void {
  draggingId.value = null
  dragOverId.value = null
}
</script>

<template>
  <div class="dash">
    <!-- 顶栏 -->
    <div class="dash__top">
      <div class="dash__hello">
        <h1 class="dash__title">首页</h1>
        <p v-if="user" class="dash__sub">你好，{{ user.name }}。文明的火种正在续燃。</p>
      </div>
      <GlobalSearchBar />
    </div>

    <!-- 主体 -->
    <div class="dash__grid">
      <p v-if="loading" class="dash__state">加载中…</p>
      <p v-else-if="error" class="dash__state dash__state--err">{{ error }}</p>
      <template v-else>
        <div
          v-for="id in visibleCards"
          :key="id"
          class="dash__slot"
          :class="{
            'dash__slot--dragging': draggingId === id,
            'dash__slot--over': dragOverId === id && draggingId !== id
          }"
          draggable="true"
          @dragstart="onDragStart(id, $event)"
          @dragover="onDragOver(id, $event)"
          @dragleave="onDragLeave"
          @drop="onDrop(id, $event)"
          @dragend="onDragEnd"
        >
          <component :is="CARD_COMPONENT[id]" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.dash__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.dash__hello {
  min-width: 0;
}

.dash__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 2px;
}

.dash__sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dash__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: min-content;
  gap: 14px;
  padding: 16px 20px;
  overflow-y: auto;
  align-content: start;
}

.dash__slot {
  cursor: grab;
  transition: opacity 0.15s;
  min-height: 140px;
}

.dash__slot:active {
  cursor: grabbing;
}

.dash__slot--dragging {
  opacity: 0.4;
}

.dash__slot--over {
  outline: 2px dashed var(--ember-500);
  outline-offset: 2px;
  border-radius: 12px;
}

.dash__state {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 40px 0;
}

.dash__state--err {
  color: var(--danger);
}
</style>
