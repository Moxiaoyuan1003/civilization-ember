/**
 * 用户（User）与个人数据（Personal Data）类型定义。
 *
 * 全局数据模型结论（贯穿全项目的宪法）：
 * - 技术树节点 / 载体 / 依赖关系 = 全局共享（火种只有一份）。
 * - "已掌握 / 阅读进度 / 标注 / 布局快照 / 个人偏好" = 个人数据，
 *   每个用户/设备各一份，靠 userId 隔离。
 *
 * 本文件定义"个人数据"这一侧的所有类型。
 */

/** 用户 */
export interface User {
  /** 用户唯一 id（设备首次启动自动生成） */
  id: string
  /** 显示名 */
  name: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
}

/** 阅读进度（按载体记录，每个用户各一份） */
export interface ReadingProgress {
  /** 载体 id */
  carrierId: string
  /** 用户 id */
  userId: string
  /** 读到的位置：书用页码、视频/音频用秒、网页用段落号 */
  position: string
  /** 已读比例（0-1） */
  percent: number
  /** 最近阅读时间（ISO 字符串） */
  updatedAt: string
}

/** 载体标注（用户在载体上做的笔记/划线） */
export interface Annotation {
  /** 标注唯一 id */
  id: string
  /** 载体 id */
  carrierId: string
  /** 用户 id */
  userId: string
  /** 标注位置（书页/时间戳/段落号） */
  location: string
  /** 标注类型：划线 / 笔记 */
  kind: 'highlight' | 'note'
  /** 标注文本（划线为原文，笔记为用户输入） */
  text: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
}

/** 技术树节点的"已掌握"标记（每个用户各一份） */
export interface MasteryRecord {
  /** 节点 id */
  nodeId: string
  /** 用户 id */
  userId: string
  /** 掌握状态 */
  mastered: boolean
  /** 更新时间（ISO 字符串） */
  updatedAt: string
}

/** 收藏/星标（针对载体，每个用户各一份） */
export interface Favorite {
  /** 载体 id */
  carrierId: string
  /** 用户 id */
  userId: string
  /** 收藏时间（ISO 字符串） */
  createdAt: string
}

/**
 * 个人偏好设置（按模块分组，每个用户各一份）。
 * 这里只存"纯偏好"，模块开关（Feature Flags）也在其中。
 */
export interface UserPreferences {
  /** 用户 id */
  userId: string
  /** 主题：深色/浅色 */
  theme: 'dark' | 'light'
  /** 技术树节点颜色方案：按层七色 / 统一琥珀系 */
  techTreeColor: 'layer' | 'ember'
  /** 技术树详情面板形态：右侧固定栏 / 抽屉浮层 */
  techTreeDetail: 'side' | 'drawer'
  /** "从这里问 AI"方式：跳转对话页 / 页内浮窗 */
  askAiMode: 'navigate' | 'inline'
  /** AI 回答出处点击行为：内嵌优先 / 直接跳转 */
  citationClick: 'preview' | 'jump'
  /** 图书馆默认视图：卡片 / 列表 */
  libraryView: 'card' | 'list'
  /**
   * 功能可见性开关（Feature Flags）：
   * 关闭 = 前端不显示 + 入口隐藏，但数据不删。
   */
  features: {
    /** 收藏/星标 */
    favorites: boolean
    /** 标注/笔记 */
    annotations: boolean
    /** 阅读进度追踪 */
    readingProgress: boolean
  }
  /**
   * 首页卡片布局（个人数据）：
   * - cardOrder：卡片显示顺序（卡片 id 数组，未列出的排最后）。
   * - hiddenCards：被隐藏的卡片 id（不在首页显示）。
   * 这是"卡片可拖拽重排 + 每卡独立开关显隐"的落点。
   */
  dashboard: {
    /** 卡片顺序（卡片 id 数组） */
    cardOrder: string[]
    /** 隐藏的卡片 id */
    hiddenCards: string[]
  }
}

/** 默认偏好（新用户/新设备首次启动时使用） */
export const DEFAULT_PREFERENCES: UserPreferences = {
  userId: '',
  theme: 'dark',
  techTreeColor: 'layer',
  techTreeDetail: 'side',
  askAiMode: 'navigate',
  citationClick: 'preview',
  libraryView: 'card',
  features: {
    favorites: true,
    annotations: true,
    readingProgress: true
  },
  dashboard: {
    cardOrder: [],
    hiddenCards: []
  }
}
