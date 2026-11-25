/**
 * Mock 技术树数据（取火 → 冶铁 → 蒸汽机 主链路）。
 *
 * 这是验证"深而真"的一条主链：从 L0 生存层的取火，到 L1 物质层的冶铁，
 * 再到 L3 能源层的蒸汽机，中间穿插木炭、鼓风、机械传动等支撑节点。
 *
 * 关键：依赖边是有向的（from=前置，to=后置），
 * 用 prerequisiteChain() 能从"蒸汽机"一路回溯到"取火"。
 */

import type { TechTree, TechNode, TechEdge } from '@/types/techTree'

/** Mock 技术树节点 */
export const mockTechNodes: TechNode[] = [
  // ---- L0 生存层 ----
  {
    id: 'n-fire',
    name: '取火',
    layer: 0,
    summary: '掌握生火，是文明第一块基石',
    description: '取火让人类获得热、光和熟食，是一切工艺的起点。钻木、火石、放大镜聚光三种方式。',
    citations: [
      { carrierId: 'c-book-survival', location: 'P12', note: '三种取火方法图解' },
      { carrierId: 'c-video-fire', location: '00:45', note: '钻木取火摩擦生热演示' }
    ],
    tags: ['火', '生存']
  },
  {
    id: 'n-wood',
    name: '木炭烧制',
    layer: 0,
    summary: '把木头闷烧成炭，获得更耐烧的高温燃料',
    description: '木炭比直接烧柴温度更高、更稳定，是冶铁燃料的关键前置。闷窑密封控温。',
    citations: [{ carrierId: 'c-web-charcoal', location: '§3', note: '闷窑烧制流程' }],
    tags: ['燃料', '炭']
  },

  // ---- L1 物质层 ----
  {
    id: 'n-iron',
    name: '冶铁',
    layer: 1,
    summary: '从矿石炼出铁，是文明进入"铁器时代"的关键一跃',
    description: '选矿、还原、冶炼、锻打。铁比青铜更普及，决定性地推动工具与武器进化。',
    citations: [
      { carrierId: 'c-book-metallurgy', location: 'P34', note: '鼓风炉还原原理' },
      { carrierId: 'c-audio-iron', location: '00:30', note: '老铁匠口述选矿经验' }
    ],
    tags: ['铁', '冶炼']
  },
  {
    id: 'n-bellows',
    name: '鼓风',
    layer: 1,
    summary: '给炉子鼓风，提高燃烧温度',
    description: '冶铁需要高温，鼓风装置（皮囊/风箱）把空气送入炉内，是冶铁的必要辅助。',
    citations: [{ carrierId: 'c-audio-iron', location: '00:00', note: '鼓风炉火候' }],
    tags: ['鼓风', '炉']
  },
  {
    id: 'n-quench',
    name: '淬火',
    layer: 1,
    summary: '烧红后急冷，让钢铁表面变硬',
    description: '淬火是钢铁热处理的核心：烧红后快速冷却，改变内部结构，使表面硬化。',
    citations: [{ carrierId: 'c-audio-iron', location: '01:10', note: '淬火使表面变硬' }],
    tags: ['热处理', '钢铁']
  },

  // ---- L2 工程层 ----
  {
    id: 'n-mechanism',
    name: '机械传动',
    layer: 2,
    summary: '齿轮、连杆、曲柄，把往复运动变成旋转运动',
    description: '蒸汽机的活塞是往复运动，要变成转轮需要连杆-曲柄机构。这是精密制造的基础。',
    citations: [{ carrierId: 'c-book-steam', location: 'P88', note: '连杆曲柄机构图解' }],
    tags: ['机械', '传动']
  },

  // ---- L3 能源层 ----
  {
    id: 'n-steam',
    name: '蒸汽机',
    layer: 3,
    summary: '把蒸汽热能转化为机械功，开启工业革命',
    description: '瓦特改良的蒸汽机把热能转化为持续旋转的机械功，是能源层里程碑。',
    citations: [{ carrierId: 'c-book-steam', location: 'P15', note: '瓦特蒸汽机原理' }],
    tags: ['蒸汽', '能源', '工业']
  }
]

/** Mock 依赖边（from=前置，to=后置） */
export const mockTechEdges: TechEdge[] = [
  { id: 'e1', from: 'n-fire', to: 'n-wood', note: '烧炭需要火源' },
  { id: 'e2', from: 'n-wood', to: 'n-iron', note: '冶铁需要木炭作高温燃料' },
  { id: 'e3', from: 'n-fire', to: 'n-iron', note: '冶铁需要火提供热能' },
  { id: 'e4', from: 'n-bellows', to: 'n-iron', note: '鼓风提高炉温' },
  { id: 'e5', from: 'n-iron', to: 'n-quench', note: '先炼出铁才能淬火' },
  { id: 'e6', from: 'n-iron', to: 'n-mechanism', note: '机械部件需要铁材' },
  { id: 'e7', from: 'n-mechanism', to: 'n-steam', note: '蒸汽机需要传动机构' },
  { id: 'e8', from: 'n-iron', to: 'n-steam', note: '蒸汽机缸体需要铸铁' }
]

/** 整棵 Mock 技术树 */
export const mockTechTree: TechTree = {
  nodes: mockTechNodes,
  edges: mockTechEdges
}
