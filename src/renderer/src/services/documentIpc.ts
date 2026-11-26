/**
 * 文档服务的 IPC 代理（渲染层）。
 *
 * 阅读器要读的正文来自主进程的解析产物。这里只取 `null` 和 `BookDoc`，
 * 没有中间态——"还没解析出来"就是 null，阅读器显示"这份载体还没解析出正文"。
 */

import type { DocumentService, DocumentMethod } from '@shared/contracts/document'
import type { BookDoc } from '@shared/types/book'

type Envelope = { ok: true; data: unknown } | { ok: false; error: string }

async function call<T>(method: DocumentMethod, ...args: unknown[]): Promise<T> {
  const bridge = window.ember?.documentInvoke
  if (!bridge) {
    throw new Error('文档服务不可用：未检测到主进程桥接（请在桌面应用中运行）')
  }
  const res = (await bridge(method, args)) as Envelope
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

/** 创建走 IPC 的文档服务 */
export function createIpcDocument(): DocumentService {
  return {
    getBookDoc: (carrierId) => call<BookDoc | null>('getBookDoc', carrierId)
  }
}
