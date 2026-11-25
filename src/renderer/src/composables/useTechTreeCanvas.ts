/**
 * 技术树画布交互（Tech Tree Canvas Composable）。
 *
 * 这是"store（数据）"与"图库引擎（画布）"之间的桥：
 * - 只负责把 store 的状态变化翻译成图库调用（渲染/高亮/选择）。
 * - 只负责把图库的用户交互（点击/悬停/拖拽）翻译回 store 动作。
 * - 不含任何业务判断，业务逻辑全在 store，渲染逻辑全在图库。
 *
 * 生命周期：调用方在组件 onMounted 时 useTechTreeCanvas(containerRef)，
 * 组件 onUnmounted 时调用返回的 destroy()。
 */

import { watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTechTreeStore } from '@/stores/techTree'
import { useServices } from '@/services'
import type { GraphService } from '@/services/graph'

export interface TechTreeCanvasApi {
  /** 图库实例（供页面直接调用 fitView/focusNode 等视口操作） */
  graph: GraphService | null
  /** 销毁：解除事件订阅 + 销毁图实例（组件卸载时调用） */
  destroy(): void
}

/**
 * 创建技术树画布桥。
 * @param containerRef 画布容器 DOM 引用（页面模板里的 div）
 */
export function useTechTreeCanvas(containerRef: Ref<HTMLElement | null>): TechTreeCanvasApi {
  const store = useTechTreeStore()
  const { tree, positions, colorScheme, gapNodeIds, highlightedNodeId, layoutRenderKey } =
    storeToRefs(store)

  // 创建图库实例（引擎固定 G6，后续从设置页偏好扩展）
  const graph: GraphService = useServices().createGraph('g6')

  /** 是否已挂载（避免每次重渲染都重建图实例、丢失高亮态） */
  let mounted = false

  /** 数据/布局/配色变化时，整帧重渲染画布 */
  function renderCanvas(): void {
    const el = containerRef.value
    const t = tree.value
    if (!el || !t) return

    // 只挂载一次；之后只重渲染数据，保留视口与高亮状态
    if (!mounted) {
      graph.mount(el)
      mounted = true
    }
    void graph.render(t, positions.value, {
      scheme: colorScheme.value,
      gapNodeIds: [...gapNodeIds.value]
    })
  }

  /* ---------- 订阅图库事件 → 回写 store ---------- */

  // 单击节点 → 选中（打开详情面板）
  graph.on('node-click', (node) => store.selectNode(node.id))
  // 悬停进入/离开 → 迷你卡
  graph.on('node-hover', (node, pos) => store.setHover(node, pos))
  graph.on('node-hover-out', () => store.setHover(null))
  // 右键节点 → 打开上下文菜单
  graph.on('node-contextmenu', (node, pos) => store.openContextMenu(node, pos))
  // 手动拖拽结束 → 把新坐标存进"我的整理"快照
  graph.on('layout-change', (nextPositions) => {
    void store.applyManualPositions(nextPositions)
  })

  /* ---------- 监听 store 变化 → 驱动图库 ---------- */

  // 数据就绪 + 布局版本号 + 配色方案 + 缺口开关 变化时重渲染
  watch(
    [tree, layoutRenderKey, colorScheme, gapNodeIds],
    () => {
      renderCanvas()
    },
    { deep: false }
  )

  // 链路高亮变化 → 高亮/清除
  watch(highlightedNodeId, (id) => {
    if (id) graph.highlightChain(id)
    else graph.clearHighlight()
  })

  return {
    graph,
    destroy(): void {
      graph.destroy()
    }
  }
}
