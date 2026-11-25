<script setup lang="ts">
/**
 * 技术树 Tech Tree：核心页（第 2 期实现）。
 *
 * 页面结构（自上而下）：
 * - 顶栏：搜索高亮目标 + 缺口开关 + 自动分层 + 适应全部 + 配色切换 + 布局快照切换。
 * - 主画布：G6 Canvas 渲染的 DAG（通过 useTechTreeCanvas 桥接 store 与图库）。
 * - 详情面板：右侧固定栏（默认），选中节点时显示（偏好 techTreeDetail 可切抽屉）。
 * - 悬浮迷你卡：悬停节点时显示。
 * - 上下文菜单：右键节点时显示。
 *
 * 职责边界：本页只"组装"，数据在 store，渲染在图库，交互逻辑在 composable。
 */

import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTechTreeStore } from '@/stores/techTree'
import { useTechTreeCanvas } from '@/composables/useTechTreeCanvas'
import TechTreeToolbar from '@/components/tech-tree/TechTreeToolbar.vue'
import NodeDetailPanel from '@/components/tech-tree/NodeDetailPanel.vue'
import NodeMiniCard from '@/components/tech-tree/NodeMiniCard.vue'
import NodeContextMenu from '@/components/tech-tree/NodeContextMenu.vue'

const store = useTechTreeStore()
const { tree, loading, error, selectedNode, hoveredNode, hoverPos, contextMenu, prefs, gapViewOn } =
  storeToRefs(store)

// 画布容器 DOM 引用
const canvasRef = ref<HTMLElement | null>(null)

// 挂载画布桥（订阅事件 + 监听 store 驱动渲染）
const canvas = useTechTreeCanvas(canvasRef)

onMounted(async () => {
  // 先加载数据，再渲染画布（composable 的 watch 会在 tree 就绪后自动 render）
  await store.load()
})

onUnmounted(() => {
  canvas.destroy()
})
</script>

<template>
  <div class="tech-tree">
    <!-- 顶栏 -->
    <TechTreeToolbar :canvas="canvas" />

    <!-- 主体：画布 + 详情面板（右侧固定栏，默认形态） -->
    <div class="tech-tree__body">
      <div class="tech-tree__canvas-wrap">
        <!-- G6 挂载点 -->
        <div ref="canvasRef" class="tech-tree__canvas"></div>

        <!-- 加载 / 错误态 -->
        <div v-if="loading" class="tech-tree__state">正在加载技术树…</div>
        <div v-else-if="error" class="tech-tree__state tech-tree__state--error">{{ error }}</div>
        <div
          v-else-if="tree && tree.nodes.length === 0"
          class="tech-tree__state"
        >
          技术树为空，先去图书馆入库并建树。
        </div>

        <!-- 悬浮迷你卡 -->
        <NodeMiniCard
          v-if="hoveredNode && !selectedNode"
          :node="hoveredNode"
          :x="hoverPos.x"
          :y="hoverPos.y"
        />

        <!-- 上下文菜单 -->
        <NodeContextMenu v-if="contextMenu" :node="contextMenu.node" :x="contextMenu.x" :y="contextMenu.y" />
      </div>

      <!-- 详情面板（右侧固定栏形态；抽屉形态后续按 prefs.techTreeDetail 切） -->
      <NodeDetailPanel v-if="selectedNode" :node="selectedNode" />
    </div>
  </div>
</template>

<style scoped>
.tech-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
}

.tech-tree__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.tech-tree__canvas-wrap {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.tech-tree__canvas {
  position: absolute;
  inset: 0;
}

/* 加载/错误/空态 */
.tech-tree__state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  pointer-events: none;
}

.tech-tree__state--error {
  color: var(--danger);
}
</style>
