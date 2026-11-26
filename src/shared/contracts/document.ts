/**
 * 文档服务契约（阅读器的数据来源）。
 *
 * 第 7 期时阅读器读的是 `mocks/data/documents.ts` 里手写的假页面。
 * 第 9 期起，正文来自**真实解析产物**：入库的 TXT / Markdown / 网页
 * 会被切成"页 + 目录"存进 documents 表，阅读器直接读库。
 *
 * 为什么第 9 期只做纯文本/网页：
 * PDF 与 EPUB 的解析是第 10 期（要接 pdfjs-dist / epub.js），
 * 但它们最终写的是**同一张 documents 表、同一个 BookDoc 结构**。
 * 先把这条路走通，第 10 期只是"多两个解析器"，阅读器一行不用改。
 */

import type { BookDoc } from '@shared/types/book'
import type { Carrier } from '@shared/types/carrier'

export interface DocumentService {
  /**
   * 取某个载体的可读正文。
   * @returns 有的返回 BookDoc；还没解析出来（或在排队）返回 null
   */
  getBookDoc(carrierId: string): Promise<BookDoc | null>
}

export const DOCUMENT_CHANNEL = 'document:invoke'

export const DOCUMENT_METHODS = ['getBookDoc'] as const

export type DocumentMethod = (typeof DOCUMENT_METHODS)[number]

/** 内部使用：把纯文本切成 BookDoc 的分页参数 */
export interface TextPaginateOptions {
  /** 每页大约多少字（中文按字算，英文按词更自然，这里统一按字符） */
  charsPerPage: number
  /** 章节识别：Markdown 的 # / ## 标题行 */
  detectMarkdownHeadings: boolean
}

export const DEFAULT_PAGINATE: TextPaginateOptions = {
  charsPerPage: 1200,
  detectMarkdownHeadings: true
}

/** 供实现方使用的载体类型判断（哪些格式第 9 期能解析成正文） */
export function canParseAsTextNow(carrier: Carrier): boolean {
  if (carrier.type === 'webpage') return true
  if (carrier.type !== 'book') return false
  const fmt = (carrier.format ?? '').toLowerCase()
  return fmt === 'txt' || fmt === 'md' || fmt === 'markdown' || fmt === 'text'
}
