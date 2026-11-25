/**
 * 文档服务接口（Document Service）。
 *
 * 阅读器的数据源抽象：把"载体 id"翻译成"可读的页文档"。
 * - 现在：Mock 实现返回预置页结构（见 mocks/document.ts）。
 * - 将来：真实实现从摄取层产物里读（PDF/EPUB 解析结果 + OCR 文本）。
 *
 * 页面只依赖这个接口，换解析实现不动阅读器代码。
 */

import type { BookDoc } from '@/types/book'

export interface DocumentService {
  /** 取某本书的文档（不存在返回 null） */
  getBookDoc(carrierId: string): Promise<BookDoc | null>
}
