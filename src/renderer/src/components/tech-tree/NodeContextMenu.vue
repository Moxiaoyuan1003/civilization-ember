<script setup lang="ts">
/**
 * 节点上下文菜单（NodeContextMenu）。
 *
 * 右键节点时在指针处弹出的小菜单：
 * - 高亮前置链
 * - 从这里问 AI（跳转对话页，带入节点上下文）
 * - 切换已掌握
 *
 * 点击画布其它位置（由页面全局监听）或执行任一动作后关闭。
 */

import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTechTreeStore } from '@/stores/techTree'
import type { TechNode } from '@shared/types/techTree'
import { Layers, MessageCircleQuestion, CheckCircle2 } from 'lucide-vue-next'

const props = defineProps<{ node: TechNode; x: number; y: number }>()

const router = useRouter()
const store = useTechTreeStore()

/** 高亮前置链 */
function highlight(): void {
  store.highlightChain(props.node.id)
  store.closeContextMenu()
}

/** 跳转 AI 对话 */
function askAi(): void {
  store.closeContextMenu()
  void router.push({ path: '/chat', query: { nodeId: props.node.id } })
}

/** 切换已掌握 */
function toggleMastery(): void {
  void store.toggleMastery(props.node.id)
  store.closeContextMenu()
}

/** 点击菜单外关闭（冒泡到全局） */
function onGlobalClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (!target.closest('.ctxmenu')) store.closeContextMenu()
}

onMounted(() => {
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<template>
  <div
    class="ctxmenu"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <button class="ctxmenu__item" @click="highlight">
      <Layers :size="14" />
      <span>高亮前置链</span>
    </button>
    <button class="ctxmenu__item" @click="toggleMastery">
      <CheckCircle2 :size="14" />
      <span>切换已掌握</span>
    </button>
    <button class="ctxmenu__item" @click="askAi">
      <MessageCircleQuestion :size="14" />
      <span>从这里问 AI</span>
    </button>
  </div>
</template>

<style scoped>
.ctxmenu {
  position: absolute;
  z-index: 100;
  min-width: 150px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.ctxmenu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.ctxmenu__item:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}
</style>
