/**
 * 载体（Carrier）类型定义。
 *
 * 载体是火种的"根"：一切知识以原始载体（书/视频/音频/图片/网页）形式存储，
 * 技术树和 AI 都是盖在载体之上的组织层。所以载体的类型定义是整个数据模型的基石。
 */

import type { LayerLevel } from './layer'

/** 载体类型：书 / 视频 / 音频 / 图片 / 网页 */
export type CarrierType = 'book' | 'video' | 'audio' | 'image' | 'webpage'

/** 载体摄取状态（对应后台批处理流水线） */
export type CarrierStatus = 'pending' | 'ingesting' | 'ready' | 'failed'

/**
 * 载体：一个知识原始素材。
 *
 * 设计说明：
 * - 载体是"全局共享数据"（火种只有一份），不随用户变化。
 * - contentHash 是内容寻址哈希：同名同内容文件只存一份，靠它去重、校验和。
 */
export interface Carrier {
  /** 载体唯一 id */
  id: string
  /** 标题 */
  title: string
  /** 类型 */
  type: CarrierType
  /** 具体格式：pdf / epub / mp4 / mp3 / png / url 等 */
  format?: string
  /** 作者 / 创作者 */
  authors?: string[]
  /** 一句话简介 */
  description?: string
  /** 文件大小（字节），网页可无 */
  sizeBytes?: number
  /** 时长（秒），视频/音频才有 */
  durationSec?: number
  /** 封面 / 缩略图路径或 URL */
  coverUrl?: string
  /** 标签（用于过滤与搜索） */
  tags: string[]
  /** 内容寻址哈希：去重与校验和的依据 */
  contentHash: string
  /** 本地文件路径（网页为来源 URL） */
  filePath?: string
  /** 网页来源 URL */
  sourceUrl?: string
  /** 摄取状态 */
  status: CarrierStatus
  /** 摄取完成时间（ISO 字符串） */
  ingestedAt?: string
  /** 入库时间（ISO 字符串） */
  createdAt: string
}

/** 载体列表过滤条件（图书馆页顶栏过滤） */
export interface CarrierFilter {
  /** 按类型过滤（空 = 全部） */
  type?: CarrierType
  /** 按标签过滤（空 = 全部） */
  tag?: string
  /** 关键词（命中标题/描述/作者） */
  keyword?: string
}

/** 载体排序方式 */
export type CarrierSort = 'recent' | 'title' | 'progress' | 'size'

/**
 * 搜索结果命中项：定位到某个载体的某个位置。
 * 全文搜索命中"书第几页"、语义搜索命中"讲淬火的段落"，都统一成这个结构。
 */
export interface SearchHit {
  /** 命中的载体 id */
  carrierId: string
  /** 命中位置：书用 "P214"、视频/音频用 "12:30"、网页用段落号 */
  location: string
  /** 命中片段摘要 */
  snippet: string
  /** 相关度得分（0-1） */
  score: number
  /** 命中来源：全文 or 语义 */
  source: 'fulltext' | 'semantic'
}

/**
 * 转写结果：视频/音频 → 带时间戳的文本。
 * 是 AI 理解音视频内容、以及"跳到视频某句"能力的基础。
 */
export interface TranscriptSegment {
  /** 起始秒 */
  startSec: number
  /** 结束秒 */
  endSec: number
  /** 该片段文本 */
  text: string
}

/** 某载体的完整转写 */
export interface Transcript {
  /** 对应载体 id */
  carrierId: string
  /** 语言（自动识别或指定） */
  language?: string
  /** 分段（带时间戳） */
  segments: TranscriptSegment[]
  /** 纯文本全文（用于建索引） */
  rawText: string
}

/**
 * 被技术树节点引用的引用项：指向"哪个载体的哪一段"。
 * 这是把"技术树节点"和"原始载体"缝合起来的关键结构。
 */
export interface Citation {
  /** 被引用的载体 id */
  carrierId: string
  /** 载体内位置：书 "P214"、视频 "12:30"、音频 "3:45"、网页段落号 */
  location: string
  /** 引用说明（为什么这段能支撑该节点） */
  note?: string
}
