/**
 * 书籍文档（Book Document）类型定义。
 *
 * 说明：
 * - 真实实现里，书的正文来自 PDF/EPUB 解析（摄取层批处理产物），按页切分。
 * - 现在用 Mock 文档模拟"解析后的页结构"，让阅读器先能真读、真翻页、真标注。
 * - 阅读器只依赖这个"文档模型"，将来换成真实解析结果不用改页面。
 */

/** 文档里的一页 */
export interface DocPage {
  /** 页码（从 1 开始） */
  pageNo: number
  /** 所属章节标题（用于目录跳转时的定位与页眉） */
  chapter: string
  /** 本页段落（纯文本；划线/笔记都落在这里的文字上） */
  paragraphs: string[]
}

/** 目录项（章节 → 起始页） */
export interface TocItem {
  /** 章节标题 */
  title: string
  /** 起始页（从 1 开始） */
  pageNo: number
  /** 该章包含的页数 */
  pageCount: number
}

/** 一本书的完整文档（阅读器的数据源） */
export interface BookDoc {
  /** 载体 id */
  carrierId: string
  /** 书名（与载体标题一致，方便阅读器标题栏直接用） */
  title: string
  /** 副标题/说明（可选） */
  subtitle?: string
  /** 全部页面 */
  pages: DocPage[]
  /** 目录 */
  toc: TocItem[]
}

/** 书签（个人数据，按用户 + 载体隔离） */
export interface Bookmark {
  /** 书签 id */
  id: string
  /** 载体 id */
  carrierId: string
  /** 用户 id */
  userId: string
  /** 所在页码 */
  pageNo: number
  /** 书签备注（可选） */
  note?: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
}

/** 阅读模式：翻页 / 连续滚动（"双模式可插拔"的落点之一） */
export type ReadingMode = 'page' | 'scroll'
