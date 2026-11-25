/**
 * 图库服务抽象接口（GraphService）。
 *
 * 技术树画布是"几百上千节点"的 DAG，必须用 Canvas 渲染（非 DOM/SVG）。
 * 本接口把"渲染引擎"抽象出来，让页面不关心底层用 G6 还是 Cytoscape / Sigma。
 *
 * 关键设计（对应"数据层与形态解耦"宪法）：
 * - 图数据（节点/边/依赖关系）是"全局共享数据"，由页面传入 render()。
 * - 画布坐标（NodePosition）是"个人数据"，由页面计算后传入 render()。
 * - 布局算法（lib/layout.ts 的 autoLayout）是纯函数，不属于任何图库，
 *   任何引擎都复用同一套坐标 —— 本接口因此**不**包含布局算法。
 *
 * 引擎切换：设置页选"渲染引擎"，运行时走 createGraph(engine) 工厂。
 */

import type { TechTree, TechNode } from '@/types/techTree'
import type { NodePosition } from '@/types/layout'
import type { TechTreeColorScheme } from '@/lib/color'
import { createG6Graph } from './graph/g6'

/** 可替换的图库引擎 */
export type GraphEngine = 'g6' | 'cytoscape' | 'sigma'

/** 渲染参数：配色方案 + 缺口节点（标红） */
export interface GraphRenderOptions {
  /** 配色方案：layer=按 L0-L6 七色（默认）/ ember=统一火种琥珀系 */
  scheme: TechTreeColorScheme
  /** 缺口节点 id 集合（缺口视图标红用） */
  gapNodeIds: string[]
}

/**
 * 图库事件映射：事件名 → 处理器签名。
 * 页面通过 on() 订阅，图库在对应交互发生时回调。
 */
export interface GraphEventMap {
  /** 单击节点（技术树页：打开详情面板） */
  'node-click': (node: TechNode) => void
  /** 右键节点（技术树页：弹出上下文菜单），position 为屏幕坐标 */
  'node-contextmenu': (node: TechNode, position: { x: number; y: number }) => void
  /** 悬停进入节点（技术树页：显示迷你卡），position 为屏幕坐标 */
  'node-hover': (node: TechNode, position: { x: number; y: number }) => void
  /** 悬停离开节点（技术树页：隐藏迷你卡） */
  'node-hover-out': () => void
  /** 手动拖拽结束后（技术树页：把新坐标存进布局快照） */
  'layout-change': (positions: NodePosition[]) => void
}

/**
 * 图库服务接口：封装一个 Canvas 图渲染引擎的完整能力。
 *
 * 生命周期：mount（挂载容器）→ render（渲染图数据+坐标）→ destroy（销毁）。
 * 交互能力：链路高亮、缺口标红、视口操作、拖拽落位、事件回调。
 */
export interface GraphService {
  /** 挂载到容器（创建底层图实例，但不渲染数据） */
  mount(container: HTMLElement): void
  /** 销毁图实例，释放资源 */
  destroy(): void
  /**
   * 渲染整棵技术树。
   * @param tree 图数据（节点/边/依赖关系，全局共享）
   * @param positions 画布坐标（个人数据，页面按布局快照算出后传入）
   * @param options 配色方案与缺口节点
   */
  render(tree: TechTree, positions: NodePosition[], options: GraphRenderOptions): Promise<void>
  /** 高亮某节点的整条前置链，其余节点变淡 */
  highlightChain(nodeId: string): void
  /** 清除链路高亮（恢复所有节点常态） */
  clearHighlight(): void
  /** 适应全部：缩放平移视口让所有节点可见 */
  fitView(): void
  /** 聚焦某节点（平移视口到它，缩放不变） */
  focusNode(nodeId: string): void
  /** 读取当前所有节点坐标（拖拽后页面用它存布局快照） */
  getPositions(): NodePosition[]
  /** 订阅图库事件 */
  on<K extends keyof GraphEventMap>(event: K, handler: GraphEventMap[K]): void
  /** 取消订阅图库事件 */
  off<K extends keyof GraphEventMap>(event: K, handler?: GraphEventMap[K]): void
}

/**
 * 图库工厂：按引擎名创建对应实现。
 *
 * 这是"双模式可插拔"的接线处：以后实现 Cytoscape/Sigma 时，
 * 各写一个 createXxxGraph()，在这里分派即可，页面零改动。
 */
export function createGraph(engine: GraphEngine): GraphService {
  if (engine === 'g6') return createG6Graph()
  // 其余引擎尚未实现，回落 G6 保证界面可用（并显式告警，方便定位）。
  console.warn(`[技术树] 图库引擎「${engine}」尚未实现，已回落使用 G6。`)
  return createG6Graph()
}
