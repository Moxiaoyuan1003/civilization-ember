/**
 * 技术树分层定义（L0–L6）。
 *
 * 分层是技术树的"横轴"：每个节点归属一层，层代表文明的演进阶段。
 * 文字与数学横切全层，不单独占用一层，而是作为"横切节点"标记。
 */
export type LayerLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** 层的元信息：代号、中文名、一句话说明 */
export interface LayerMeta {
  /** 层编号 0-6 */
  level: LayerLevel
  /** 层代号（英文，用于代码标识） */
  code: string
  /** 层中文名 */
  name: string
  /** 层的一句话说明 */
  desc: string
}

/** 七层元信息表（顺序即层级递增） */
export const LAYERS: LayerMeta[] = [
  { level: 0, code: 'survival', name: '生存层', desc: '活下去：火、食物、住所、工具' },
  { level: 1, code: 'material', name: '物质层', desc: '改造自然：陶、冶、纺织、采矿' },
  { level: 2, code: 'engineering', name: '工程层', desc: '精密制造：机械、结构、动力传动' },
  { level: 3, code: 'energy', name: '能源层', desc: '驾驭能量：蒸汽、电力、内燃、核' },
  { level: 4, code: 'information', name: '信息层', desc: '记录与传播：印刷、电报、通信、互联网' },
  { level: 5, code: 'computing', name: '计算层', desc: '自动计算：计算机、软件、算法、AI' },
  { level: 6, code: 'meta', name: '元层', desc: '文明的地基：文字、数学、科学方法' }
]

/**
 * 根据层号取层元信息。
 * @param level 层号
 * @returns 对应层元信息；未匹配时抛错（保证数据一致性）
 */
export function layerOf(level: LayerLevel): LayerMeta {
  const meta = LAYERS.find((l) => l.level === level)
  if (!meta) throw new Error(`未知的层级：${level}`)
  return meta
}
