<script setup lang="ts">
/**
 * 技术树节点详情面板（NodeDetailPanel）。
 *
 * 展示选中节点的完整信息：
 * - 标题行（名称 + 层名 + 缺口角标 + 已掌握开关）。
 * - 摘要 + 详细综述。
 * - 前置依赖（from → 本节点）+ 后置解锁（本节点 → to）。
 * - 引用载体列表（可点击跳转到图书馆对应载体）。
 * - 操作按钮组（问 AI / 高亮链路）。
 *
 * 数据层与形态解耦：本组件只消费 store，不关心画布怎么画。
 * 形态（右侧固定栏 / 抽屉浮层）由页面按偏好切换，本组件内容不变。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTechTreeStore } from '@/stores/techTree'
import { layerOf } from '@shared/types/layer'
import type { TechNode } from '@shared/types/techTree'
import type { Citation } from '@shared/types/carrier'
import { X, BookOpen, MessageCircleQuestion, Layers, CheckCircle2, Circle } from 'lucide-vue-next'

const props = defineProps<{ node: TechNode }>()

const router = useRouter()
const store = useTechTreeStore()
const { tree, mastered, gaps, nodeMap } = storeToRefs(store)

/** 本节点的层元信息 */
const layerMeta = computed(() => layerOf(props.node.layer))

/** 本节点是否为缺口节点（缺引用/缺前置） */
const isGap = computed(() => gaps.value.some((g) => g.nodeId === props.node.id))

/** 前置依赖边（to = 本节点） */
const prerequisites = computed(() =>
  (tree.value?.edges ?? [])
    .filter((e) => e.to === props.node.id)
    .map((e) => ({ edge: e, node: nodeMap.value.get(e.from) }))
)

/** 后置解锁边（from = 本节点） */
const unlocks = computed(() =>
  (tree.value?.edges ?? [])
    .filter((e) => e.from === props.node.id)
    .map((e) => ({ edge: e, node: nodeMap.value.get(e.to) }))
)

/** 本节点是否已掌握 */
const isMastered = computed(() => mastered.value.has(props.node.id))

/** 切换已掌握 */
function toggleMastery(): void {
  void store.toggleMastery(props.node.id)
}

/** 高亮本节点的前置链 */
function highlight(): void {
  store.highlightChain(props.node.id)
}

/** 跳转到 AI 对话页，带入本节点上下文 */
function askAi(): void {
  void router.push({ path: '/chat', query: { nodeId: props.node.id } })
}

/** 跳转到图书馆某载体 */
function goCarrier(carrierId: string): void {
  void router.push({ path: '/library', query: { carrierId } })
}
</script>

<template>
  <aside class="detail">
    <!-- 标题行 -->
    <header class="detail__header">
      <div class="detail__title">
        <span class="detail__dot" :style="{ background: `var(--layer-${node.layer})` }"></span>
        <h2 class="detail__name">{{ node.name }}</h2>
        <span v-if="isGap" class="detail__gap" title="该节点存在缺口">缺口</span>
      </div>
      <button class="detail__close" title="关闭详情" @click="store.clearSelection()">
        <X :size="16" />
      </button>
    </header>

    <!-- 层 + 掌握 -->
    <div class="detail__meta">
      <span class="detail__layer">{{ layerMeta.name }}（L{{ node.layer }}）</span>
      <button
        class="detail__mastery"
        :class="{ 'detail__mastery--on': isMastered }"
        @click="toggleMastery"
      >
        <CheckCircle2 v-if="isMastered" :size="14" />
        <Circle v-else :size="14" />
        <span>{{ isMastered ? '已掌握' : '未掌握' }}</span>
      </button>
    </div>

    <!-- 摘要 -->
    <p class="detail__summary">{{ node.summary }}</p>

    <!-- 详细综述 -->
    <section v-if="node.description" class="detail__section">
      <h3 class="detail__section-title">综述</h3>
      <p class="detail__desc">{{ node.description }}</p>
    </section>

    <!-- 前置依赖 -->
    <section v-if="prerequisites.length" class="detail__section">
      <h3 class="detail__section-title">前置依赖</h3>
      <ul class="detail__list">
        <li v-for="p in prerequisites" :key="p.edge.id" class="detail__item">
          <span class="detail__item-name">{{ p.node?.name ?? p.edge.from }}</span>
          <span v-if="p.edge.note" class="detail__item-note">{{ p.edge.note }}</span>
        </li>
      </ul>
    </section>

    <!-- 后置解锁 -->
    <section v-if="unlocks.length" class="detail__section">
      <h3 class="detail__section-title">解锁</h3>
      <ul class="detail__list">
        <li v-for="u in unlocks" :key="u.edge.id" class="detail__item">
          <span class="detail__item-name">{{ u.node?.name ?? u.edge.to }}</span>
          <span v-if="u.edge.note" class="detail__item-note">{{ u.edge.note }}</span>
        </li>
      </ul>
    </section>

    <!-- 引用载体 -->
    <section v-if="node.citations.length" class="detail__section">
      <h3 class="detail__section-title">引用载体</h3>
      <ul class="detail__list">
        <li
          v-for="(c, i) in node.citations"
          :key="i"
          class="detail__item detail__item--link"
          @click="goCarrier(c.carrierId)"
        >
          <BookOpen :size="13" class="detail__item-icon" />
          <span class="detail__item-name">{{ c.carrierId }}</span>
          <span class="detail__item-loc">{{ c.location }}</span>
          <span v-if="c.note" class="detail__item-note">{{ c.note }}</span>
        </li>
      </ul>
    </section>

    <!-- 操作按钮组 -->
    <footer class="detail__actions">
      <button class="detail__action" @click="highlight">
        <Layers :size="14" />
        <span>高亮链路</span>
      </button>
      <button class="detail__action detail__action--primary" @click="askAi">
        <MessageCircleQuestion :size="14" />
        <span>从这里问 AI</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.detail {
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

.detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.detail__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.detail__name {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
}

.detail__gap {
  font-size: 11px;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
}

.detail__close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.detail__close:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.detail__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detail__layer {
  font-size: 12px;
  color: var(--text-secondary);
}

.detail__mastery {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  padding: 3px 8px;
  cursor: pointer;
}

.detail__mastery--on {
  color: var(--success);
  border-color: var(--success);
}

.detail__summary {
  font-size: 13px;
  color: var(--text-primary);
  margin: 0;
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.detail__desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.detail__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail__item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 6px;
}

.detail__item--link {
  cursor: pointer;
}

.detail__item--link:hover {
  background: var(--bg-surface-hover);
}

.detail__item-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  align-self: center;
}

.detail__item-name {
  color: var(--text-primary);
  flex-shrink: 0;
}

.detail__item-loc {
  color: var(--ember-400);
  font-size: 12px;
  flex-shrink: 0;
}

.detail__item-note {
  color: var(--text-muted);
  font-size: 12px;
}

.detail__actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.detail__action {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.detail__action:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.detail__action--primary {
  border-color: var(--ember-500);
  color: var(--ember-400);
}
</style>
