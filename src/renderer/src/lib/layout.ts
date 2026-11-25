/**
 * 布局纯函数（Layout）。
 *
 * 自动分层布局算法：按"依赖拓扑深度"把节点纵向分层、同层横向展开。
 *
 * 关键设计（对应"数据层与形态解耦"）：
 * - 本文件是纯函数，不碰 DOM、不碰图库，只算坐标。
 * - 任何图库（G6/Cytoscape/Sigma）都能复用同一套坐标。
 * - 层号 node.layer（文明演进阶段 L0-L6，人工标注）与拓扑深度 depth（依赖链位置，自动算出）
 *   是两回事：这里用 depth 做主纵轴，保证"取火→木炭→冶铁→蒸汽机"严格自上而下。
 */

import type { TechTree, TechNode, TechEdge } from '@/types/techTree'
import type { NodePosition } from '@/types/layout'

/** 纵向层间距（像素） */
const LAYER_GAP_Y = 140

/** 横向节点间距（像素） */
const NODE_GAP_X = 180

/**
 * 拓扑分层：计算每个节点的"层级深度"。
 * 深度 = 从根节点（无前置）到该节点的最长路径长度（根 = 0）。
 *
 * @param nodes 全部节点
 * @param edges 全部依赖边（from=前置, to=后置）
 * @returns nodeId -> depth 的映射
 */
export function computeDepth(nodes: TechNode[], edges: TechEdge[]): Map<string, number> {
  const depth = new Map<string, number>()
  const incoming = new Map<string, string[]>()
  // 反向索引：to -> from[]，便于从后往前找前置
  for (const e of edges) {
    const list = incoming.get(e.to) ?? []
    list.push(e.from)
    incoming.set(e.to, list)
  }
  // 递归求"最长前置深度 + 1"
  function visit(id: string): number {
    const cached = depth.get(id)
    if (cached !== undefined) return cached
    const parents = incoming.get(id) ?? []
    const d = parents.length === 0 ? 0 : Math.max(...parents.map(visit)) + 1
    depth.set(id, d)
    return d
  }
  for (const n of nodes) visit(n.id)
  return depth
}

/**
 * 自动分层布局：生成一套坐标。
 * 同一深度的节点横向均匀展开，以 x=0 为中心；深度越大 y 越大（越往下）。
 *
 * @param tree 技术树
 * @returns 每个节点的画布坐标
 */
export function autoLayout(tree: TechTree): NodePosition[] {
  const depth = computeDepth(tree.nodes, tree.edges)

  // 按 depth 分组
  const groups = new Map<number, string[]>()
  for (const n of tree.nodes) {
    const d = depth.get(n.id) ?? 0
    const list = groups.get(d) ?? []
    list.push(n.id)
    groups.set(d, list)
  }

  const positions: NodePosition[] = []
  for (const [d, ids] of groups) {
    const count = ids.length
    const totalWidth = (count - 1) * NODE_GAP_X
    ids.forEach((id, i) => {
      positions.push({
        nodeId: id,
        x: i * NODE_GAP_X - totalWidth / 2,
        y: d * LAYER_GAP_Y
      })
    })
  }
  return positions
}
