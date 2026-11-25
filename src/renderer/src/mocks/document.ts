/**
 * Mock 文档服务：从预置页文档里取书。
 *
 * 真实实现会去读摄取层解析产物（PDF/EPUB → 页 + 目录），
 * 这里用 mock 数据顶替，保证阅读器的所有功能（翻页/目录/划线/进度）都能真跑。
 */

import type { DocumentService } from '@/services/document'
import type { BookDoc } from '@/types/book'
import { findMockBookDoc } from '@/mocks/data/documents'

export function createMockDocument(): DocumentService {
  return {
    async getBookDoc(carrierId: string): Promise<BookDoc | null> {
      // 模拟一点点解析延迟，让"加载中"状态在界面上真实出现过
      await new Promise((resolve) => setTimeout(resolve, 80))
      return findMockBookDoc(carrierId)
    }
  }
}
