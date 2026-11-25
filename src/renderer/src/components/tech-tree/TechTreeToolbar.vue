<script setup lang="ts">
/**
 * 技术树顶栏（TechTreeToolbar）。
 *
 * 承载技术树页的顶部操作（对应主画布五组功能的入口）：
 * - 链路高亮：输入目标节点名 + 高亮按钮。
 * - 缺口视图：开关（默认开，缺口节点标红）。
 * - 视口：自动分层、适应全部。
 * - 布局快照：系统自动分层 / 我的整理 切换。
 * - 配色方案：按层七色 / 火种琥珀系（双模式，联动偏好）。
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTechTreeStore } from '@/stores/techTree'
import type { TechTreeCanvasApi } from '@/composables/useTechTreeCanvas'
import {
  Search,
  AlertTriangle,
  LayoutGrid,
  Maximize,
  Palette,
  Layers,
  RotateCcw
} from 'lucide-vue-next'

const store = useTechTreeStore()
const { tree, gapViewOn, prefs, activePresetId, highlightedNodeId, nodeMap } = storeToRefs(store)

// 画布桥（页面传入，用于视口操作）
const props = defineProps<{ canvas: TechTreeCanvasApi | null }>()

// 链路高亮的搜索关键词
const highlightQuery = ref('')

/** 高亮目标节点 id（搜索框匹配到节点时） */
const highlightTarget = computed<string | null>(() => {
  const q = highlightQuery.value.trim()
  if (!q) return null
  const node = (tree.value?.nodes ?? []).find((n) => n.name.includes(q))
  return node?.id ?? null
})

/** 是否有可切换的配色方案（仅当有偏好） */
const schemeLabel = computed(() => (prefs.value.techTreeColor === 'layer' ? '按层七色' : '火种琥珀'))

/** 触发链路高亮（搜索框匹配的节点） */
function doHighlight(): void {
  if (highlightTarget.value) store.highlightChain(highlightTarget.value)
}

/** 清除高亮 */
function clearHighlight(): void {
  store.clearHighlight()
  highlightQuery.value = ''
}

/** 切换缺口视图 */
function toggleGap(): void {
  gapViewOn.value = !gapViewOn.value
}

/** 自动分层布局 */
function autoLayout(): void {
  store.applyAutoLayout()
}

/** 适应全部（图库视口） */
function fitView(): void {
  props.canvas?.graph?.fitView()
}

/** 切换配色方案（双模式） */
function toggleScheme(): void {
  prefs.value.techTreeColor = prefs.value.techTreeColor === 'layer' ? 'ember' : 'layer'
}

/** 切换布局快照 */
function togglePreset(): void {
  if (activePresetId.value === 'lp-system') {
    // 切到"我的整理"（若存在）
    const manual = store.presets.find((p) => p.id === 'lp-manual')
    if (manual) store.switchPreset('lp-manual')
  } else {
    store.switchPreset('lp-system')
  }
}
</script>

<template>
  <div class="toolbar">
    <!-- 链路高亮：搜索 + 高亮 -->
    <div class="toolbar__group">
      <div class="toolbar__search">
        <Search :size="14" class="toolbar__search-icon" />
        <input
          v-model="highlightQuery"
          class="toolbar__input"
          placeholder="搜索节点高亮前置链…"
          @keyup.enter="doHighlight"
        />
      </div>
      <button
        class="toolbar__btn"
        :disabled="!highlightTarget"
        title="高亮该节点的整条前置链"
        @click="doHighlight"
      >
        <Layers :size="15" />
        <span>高亮链路</span>
      </button>
      <button
        v-if="highlightedNodeId"
        class="toolbar__btn"
        title="清除链路高亮"
        @click="clearHighlight"
      >
        <RotateCcw :size="15" />
        <span>清除</span>
      </button>
    </div>

    <!-- 缺口视图开关 -->
    <button
      class="toolbar__btn"
      :class="{ 'toolbar__btn--active': gapViewOn }"
      title="开启/关闭缺口视图（缺口节点标红）"
      @click="toggleGap"
    >
      <AlertTriangle :size="15" />
      <span>缺口</span>
    </button>

    <!-- 视口：自动分层 / 适应全部 -->
    <button class="toolbar__btn" title="自动分层布局" @click="autoLayout">
      <LayoutGrid :size="15" />
      <span>自动分层</span>
    </button>
    <button class="toolbar__btn" title="缩放适应全部节点" @click="fitView">
      <Maximize :size="15" />
      <span>适应全部</span>
    </button>

    <!-- 布局快照切换 -->
    <button class="toolbar__btn" title="切换布局快照" @click="togglePreset">
      <span>{{ activePresetId === 'lp-system' ? '系统分层' : '我的整理' }}</span>
    </button>

    <!-- 配色方案切换（双模式） -->
    <button class="toolbar__btn" title="切换配色方案" @click="toggleScheme">
      <Palette :size="15" />
      <span>{{ schemeLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
  flex-wrap: wrap;
}

.toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 30px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.toolbar__search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.toolbar__input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  width: 180px;
}

.toolbar__input::placeholder {
  color: var(--text-muted);
}

.toolbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.toolbar__btn:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.toolbar__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar__btn--active {
  border-color: var(--ember-500);
  color: var(--ember-400);
}
</style>
