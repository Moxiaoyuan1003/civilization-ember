/**
 * 技术树（TechTree）类型定义。
 *
 * 技术树是文明重建的"路书"：有向无环图（DAG，非纯树），
 * 节点 = 主题锚点 + 依赖边 + 综述 + 引用（指向载体）。
 *
 * 关键设计：
 * - 节点/边/依赖关系是"全局共享数据"（火种只有一份）。
 * - 节点的位置（画布坐标）是"个人数据"，不存这里，存到布局快照（见 layout.ts）。
 *   这是"数据层与形态解耦"的体现：图的数据不关心它在画布上怎么摆。
 */

import type { LayerLevel } from './layer'
import type { Citation } from './carrier'

/** 技术树节点（一个文明知识点/技能锚点） */
export interface TechNode {
  /** 节点唯一 id */
  id: string
  /** 节点名称（如"取火""冶铁""蒸汽机"） */
  name: string
  /** 归属层 0-6 */
  layer: LayerLevel
  /** 一句话摘要 */
  summary: string
  /** 详细综述（这个节点"讲的是什么、为什么重要、怎么做"） */
  description?: string
  /** 是否为"横切节点"（文字/数学这类贯穿全层的通用能力） */
  isTransversal?: boolean
  /** 引用载体（哪些书/视频的哪一段支撑了这个节点） */
  citations: Citation[]
  /** 额外标签 */
  tags?: string[]
}

/** 技术树依赖边（有向：from 是前置，to 是后置，即"要先掌握 from 才能做 to"） */
export interface TechEdge {
  /** 边唯一 id */
  id: string
  /** 前置节点 id */
  from: string
  /** 后置节点 id */
  to: string
  /** 依赖说明（为什么需要这个前置） */
  note?: string
}

/**
 * 缺口类型：技术树里"还不完整"的地方。
 * 这是"缺口视图"（技术树页标红）的数据来源。
 */
export type GapKind = 'missing-citation' | 'missing-prerequisite'

/** 缺口项 */
export interface TechGap {
  /** 缺口类型 */
  kind: GapKind
  /** 涉及的节点 id */
  nodeId: string
  /** 缺口说明 */
  message: string
  /** 涉及的前置节点 id（缺前置时才有） */
  prerequisiteId?: string
}

/** 整棵技术树（只含全局共享的图数据） */
export interface TechTree {
  /** 所有节点 */
  nodes: TechNode[]
  /** 所有依赖边 */
  edges: TechEdge[]
}

/**
 * 依赖关系工具：从树中找出某节点的"前置链"（一直追溯到根）。
 * 这是"链路高亮"功能的核心算法。
 *
 * @param tree 技术树
 * @param nodeId 目标节点 id
 * @returns 前置链上的所有节点 id（含目标自身）
 */
export function prerequisiteChain(tree: TechTree, nodeId: string): string[] {
  const result = new Set<string>()
  const stack = [nodeId]
  // 反向索引：to -> from[]，便于从后往前找前置
  const incoming = new Map<string, string[]>()
  for (const e of tree.edges) {
    const list = incoming.get(e.to) ?? []
    list.push(e.from)
    incoming.set(e.to, list)
  }
  // 深度优先回溯
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (result.has(cur)) continue
    result.add(cur)
    for (const from of incoming.get(cur) ?? []) stack.push(from)
  }
  return [...result]
}
