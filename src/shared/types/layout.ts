/**
 * 布局快照（Layout Preset）类型定义。
 *
 * 这是"自动分层布局 vs 手动拖拽整理"冲突的解决方案：
 * - 自动分层布局 = 系统预设快照（每次重算覆盖"系统快照"这一份）。
 * - 用户手动拖拽后 = 自动存成用户快照。
 * - 多套快照平级共存、互不覆盖，切换只是"换一套坐标"。
 *
 * 关键设计：节点的图数据（依赖关系）与技术形态（画布坐标）彻底解耦。
 * 坐标是"个人数据"（user_id 隔离），图数据是"全局共享数据"。
 */

/** 某节点在一套布局里的画布坐标 */
export interface NodePosition {
  /** 节点 id */
  nodeId: string
  /** 画布 x 坐标 */
  x: number
  /** 画布 y 坐标 */
  y: number
}

/** 布局快照（一套完整坐标方案） */
export interface LayoutPreset {
  /** 快照唯一 id */
  id: string
  /** 快照名称（如"系统自动分层""我整理的"） */
  name: string
  /** 是否为系统自动分层生成的预设（用户不可覆盖，只可另存副本） */
  isSystem: boolean
  /** 归属用户 id（个人数据；系统预设为 null，全局共享） */
  userId: string | null
  /** 所有节点坐标 */
  positions: NodePosition[]
  /** 创建/更新时间（ISO 字符串） */
  updatedAt: string
}
