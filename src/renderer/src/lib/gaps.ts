/**
 * 缺口检测纯函数（Gap Detection）。
 *
 * "缺口视图"的数据来源：找出技术树里"还不完整"的地方。
 * 两类缺口：
 * - missing-citation：节点没有任何引用载体（有知识点，但没书/视频支撑）。
 * - missing-prerequisite：边指向的前置节点在节点列表里不存在（数据悬空）。
 *
 * 纯函数，不碰 DOM/图库，供技术树页与"策展补漏"AI 模式共用。
 */

import type { TechTree, TechGap } from '@shared/types/techTree'

/**
 * 扫描整棵树，返回所有缺口。
 *
 * @param tree 技术树
 * @returns 缺口列表（可能为空）
 */
export function detectGaps(tree: TechTree): TechGap[] {
  const gaps: TechGap[] = []
  const nodeIds = new Set(tree.nodes.map((n) => n.id))

  // 1) 缺引用：节点没有任何 citation 支撑
  for (const n of tree.nodes) {
    if (n.citations.length === 0) {
      gaps.push({
        kind: 'missing-citation',
        nodeId: n.id,
        message: `「${n.name}」没有任何引用载体，缺少可读的原书/视频支撑。`
      })
    }
  }

  // 2) 缺前置：边引用了不存在的节点（数据悬空）
  for (const e of tree.edges) {
    if (!nodeIds.has(e.from)) {
      gaps.push({
        kind: 'missing-prerequisite',
        nodeId: e.to,
        prerequisiteId: e.from,
        message: `「${e.to}」依赖的前置节点「${e.from}」不存在，链路断裂。`
      })
    }
    if (!nodeIds.has(e.to)) {
      gaps.push({
        kind: 'missing-prerequisite',
        nodeId: e.from,
        prerequisiteId: e.to,
        message: `「${e.from}」指向的后置节点「${e.to}」不存在。`
      })
    }
  }

  return gaps
}
