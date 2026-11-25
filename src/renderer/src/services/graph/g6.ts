/**
 * G6 v5 图库适配器（GraphService 的 G6 实现）。
 *
 * 这是"可插拔图库"的第一个真实实现：把 AntV G6 v5 的 API
 * 翻译成项目自己的 GraphService 接口。以后换 Cytoscape / Sigma，
 * 各写一个适配器实现同一接口，页面零改动。
 *
 * 关键映射（本项目概念 → G6 v5 概念）：
 * - TechTree 图数据 → GraphData{nodes, edges}。
 * - NodePosition 画布坐标 → nodes[].style.x / style.y。
 * - 链路高亮 / 缺口标红 → G6 的状态机制（setElementState 替换语义）。
 * - 手动拖拽落位 → drag-element 行为的 onFinish 回调读坐标。
 *
 * 注意：G6 v5 的 setElementState 是"替换"语义（覆盖而非叠加），
 * 所以清高亮 = 传空数组，设高亮 = 传 ['highlight']。
 */

import { Graph, NodeEvent } from '@antv/g6'
import type { GraphService, GraphEventMap, GraphRenderOptions } from '@/services/graph'
import type { TechTree, TechNode } from '@/types/techTree'
import type { NodePosition } from '@/types/layout'
import { prerequisiteChain } from '@/types/techTree'
import { nodeColor, readCssVar } from '@/lib/color'

/** 节点尺寸（矩形，宽 x 高） */
const NODE_W = 150
const NODE_H = 44

/** 节点/边状态名（与 node.state / edge.state 配置表对应） */
const STATE_HIGHLIGHT = 'highlight'
const STATE_DIM = 'dim'

/** 从 G6 事件对象里防御性提取指针的客户端坐标（供迷你卡定位） */
function extractClientPos(e: unknown): { x: number; y: number } {
  const ev = e as Record<string, unknown>
  // 优先取 G6 事件里的 client 点（{x,y}）
  const client = ev?.client as { x?: number; y?: number } | undefined
  if (client && typeof client.x === 'number' && typeof client.y === 'number') {
    return { x: client.x, y: client.y }
  }
  // 退回 originalEvent 的 FederatedPointerEvent（clientX/clientY）
  const oe = ev?.originalEvent as { clientX?: number; clientY?: number } | undefined
  if (oe && typeof oe.clientX === 'number' && typeof oe.clientY === 'number') {
    return { x: oe.clientX, y: oe.clientY }
  }
  return { x: 0, y: 0 }
}

/** 从 G6 事件对象里防御性提取被点击元素的 id（节点 id） */
function extractTargetId(e: unknown): string {
  const target = (e as Record<string, unknown>).target as { id?: unknown } | undefined
  return typeof target?.id === 'string' ? target.id : ''
}

/** 创建 G6 v5 图库服务实例 */
export function createG6Graph(): GraphService {
  /** 底层 G6 图实例（mount 后非空） */
  let graph: Graph | null = null

  /** 最近一次渲染的技术树（用于链路高亮时反查节点与边） */
  let tree: TechTree | null = null

  /** 节点 id → 节点对象 映射（事件回调里按 id 反查 TechNode） */
  let nodeMap = new Map<string, TechNode>()

  /** 当前各节点坐标（拖拽后更新，getPositions 读取） */
  let currentPos = new Map<string, { x: number; y: number }>()

  /** 事件处理器注册表（event → handler 集合） */
  const handlers = new Map<keyof GraphEventMap, Set<GraphEventMap[keyof GraphEventMap]>>()

  /** 触发某个事件（通知页面） */
  function emit<K extends keyof GraphEventMap>(event: K, ...args: Parameters<GraphEventMap[K]>): void {
    const set = handlers.get(event)
    if (!set) return
    // 逐个调用处理器
    for (const h of set) (h as (...a: Parameters<GraphEventMap[K]>) => void)(...args)
  }

  /** 把技术树 + 坐标 + 渲染参数翻译成 G6 的 GraphData */
  function buildGraphData(
    t: TechTree,
    positions: NodePosition[],
    options: GraphRenderOptions
  ): { nodes: unknown[]; edges: unknown[] } {
    // 坐标映射：nodeId -> {x,y}
    const posMap = new Map(positions.map((p) => [p.nodeId, p]))
    // 缺口节点集合
    const gapSet = new Set(options.gapNodeIds)

    const nodes = t.nodes.map((n) => {
      const p = posMap.get(n.id)
      const isGap = gapSet.has(n.id)
      const fill = nodeColor(n.layer, options.scheme)
      return {
        id: n.id,
        type: 'rect',
        style: {
          x: p?.x ?? 0,
          y: p?.y ?? 0,
          size: [NODE_W, NODE_H],
          fill,
          stroke: isGap ? readCssVar('--danger', '#ef4444') : readCssVar('--border', '#475569'),
          lineWidth: isGap ? 2.5 : 1,
          radius: 8,
          // 显式声明常态透明度 = 1：链路高亮的 dim 态会把它改成 0.15，
          // 清除高亮时靠这里的 1 覆盖回去（G6 的 updateStyle 只设置存在的字段，
          // 若这里不写 opacity，清高亮后 style 里没有该字段，节点会卡在灰色态）。
          opacity: 1,
          labelText: n.name,
          labelPlacement: 'center',
          labelFill: '#ffffff',
          labelFontSize: 13,
          labelFontWeight: 500
        }
      }
    })

    const edges = t.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'cubic',
      style: {
        stroke: readCssVar('--border', '#475569'),
        lineWidth: 1.5,
        // 同上：显式声明常态透明度 = 1，供清高亮时覆盖 dim 态的 0.12。
        opacity: 1,
        endArrow: true,
        endArrowType: 'triangle',
        endArrowSize: 8
      }
    }))

    return { nodes, edges }
  }

  /** 更新所有节点坐标缓存（从 graph 实时读取） */
  function syncPositionsFromGraph(): void {
    if (!graph || !tree) return
    const next = new Map<string, { x: number; y: number }>()
    for (const n of tree.nodes) {
      try {
        const p = graph.getElementPosition(n.id)
        next.set(n.id, { x: p[0] ?? 0, y: p[1] ?? 0 })
      } catch {
        // 节点可能尚未绘制，跳过
      }
    }
    currentPos = next
  }

  /** 读取当前所有节点坐标（拖拽后页面用它存布局快照） */
  function getPositions(): NodePosition[] {
    return [...currentPos.entries()].map(([nodeId, p]) => ({ nodeId, x: p.x, y: p.y }))
  }

  return {
    mount(container: HTMLElement): void {
      // 已挂载则先销毁，避免重复实例
      if (graph) graph.destroy()

      graph = new Graph({
        container,
        autoResize: true,
        // 关闭内置主题，颜色全由项目 CSS 变量控制
        theme: false,
        // 基础交互：平移 + 滚轮缩放 + 拖拽节点
        behaviors: [
          'drag-canvas',
          'zoom-canvas',
          {
            type: 'drag-element',
            // 拖拽结束回调：读新坐标 → 通知页面存布局快照
            onFinish: () => {
              syncPositionsFromGraph()
              emit('layout-change', getPositions())
            }
          }
        ],
        // 节点样式与状态表
        node: {
          type: 'rect',
          state: {
            [STATE_HIGHLIGHT]: {
              lineWidth: 3,
              stroke: readCssVar('--ember-400', '#f59e0b'),
              opacity: 1
            },
            [STATE_DIM]: { opacity: 0.15 }
          }
        },
        // 边样式与状态表
        edge: {
          type: 'cubic',
          state: {
            [STATE_HIGHLIGHT]: {
              stroke: readCssVar('--ember-400', '#f59e0b'),
              lineWidth: 2.5,
              opacity: 1
            },
            [STATE_DIM]: { opacity: 0.12 }
          }
        }
      })

      // ---- 事件接线：把 G6 事件翻译成 GraphEventMap ----
      // 说明：G6 的 graph.on 回调参数是 IEvent 联合类型，
      // 这里用 unknown 接收再防御性提取，避免与具体事件类型硬绑死。
      graph.on(NodeEvent.CLICK, (e: unknown) => {
        const node = nodeMap.get(extractTargetId(e))
        if (node) emit('node-click', node)
      })
      graph.on(NodeEvent.CONTEXT_MENU, (e: unknown) => {
        const node = nodeMap.get(extractTargetId(e))
        if (node) emit('node-contextmenu', node, extractClientPos(e))
      })
      graph.on(NodeEvent.POINTER_ENTER, (e: unknown) => {
        const node = nodeMap.get(extractTargetId(e))
        if (node) emit('node-hover', node, extractClientPos(e))
      })
      graph.on(NodeEvent.POINTER_LEAVE, () => {
        emit('node-hover-out')
      })
    },

    destroy(): void {
      if (graph) {
        graph.destroy()
        graph = null
      }
      tree = null
      nodeMap = new Map()
      currentPos = new Map()
      handlers.clear()
    },

    async render(t: TechTree, positions: NodePosition[], options: GraphRenderOptions): Promise<void> {
      if (!graph) throw new Error('图库尚未挂载：请先调用 mount(container)')

      tree = t
      nodeMap = new Map(t.nodes.map((n) => [n.id, n]))
      currentPos = new Map(positions.map((p) => [p.nodeId, { x: p.x, y: p.y }]))

      const data = buildGraphData(t, positions, options)
      graph.setData(data as never)
      await graph.render()
    },

    highlightChain(nodeId: string): void {
      if (!graph || !tree) return
      // 计算前置链（含目标自身）
      const chain = new Set(prerequisiteChain(tree, nodeId))

      // 节点：链上高亮，其余变淡
      const nodeStates: Record<string, string[]> = {}
      for (const n of tree.nodes) {
        nodeStates[n.id] = chain.has(n.id) ? [STATE_HIGHLIGHT] : [STATE_DIM]
      }
      // 边：两端都在链上才高亮，否则变淡
      const edgeStates: Record<string, string[]> = {}
      for (const e of tree.edges) {
        edgeStates[e.id] = chain.has(e.from) && chain.has(e.to) ? [STATE_HIGHLIGHT] : [STATE_DIM]
      }

      graph.setElementState(nodeStates)
      graph.setElementState(edgeStates)
    },

    clearHighlight(): void {
      if (!graph || !tree) return
      const nodeStates: Record<string, string[]> = {}
      for (const n of tree.nodes) nodeStates[n.id] = []
      const edgeStates: Record<string, string[]> = {}
      for (const e of tree.edges) edgeStates[e.id] = []

      graph.setElementState(nodeStates)
      graph.setElementState(edgeStates)
    },

    fitView(): void {
      if (!graph) return
      void graph.fitView()
    },

    focusNode(nodeId: string): void {
      if (!graph) return
      void graph.focusElement(nodeId)
    },

    getPositions(): NodePosition[] {
      return [...currentPos.entries()].map(([nodeId, p]) => ({ nodeId, x: p.x, y: p.y }))
    },

    on<K extends keyof GraphEventMap>(event: K, handler: GraphEventMap[K]): void {
      let set = handlers.get(event)
      if (!set) {
        set = new Set()
        handlers.set(event, set)
      }
      set.add(handler as GraphEventMap[keyof GraphEventMap])
    },

    off<K extends keyof GraphEventMap>(event: K, handler?: GraphEventMap[K]): void {
      const set = handlers.get(event)
      if (!set) return
      if (handler) {
        set.delete(handler as GraphEventMap[keyof GraphEventMap])
      } else {
        set.clear()
      }
    }
  }
}
