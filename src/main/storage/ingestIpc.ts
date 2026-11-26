/**
 * 摄取与文档的 IPC 通道（主进程侧）。
 *
 * 与 storage 的 IPC 一模一样的套路：单一通道 + 方法名白名单 + 统一信封。
 * 两个服务放在一个文件里，因为它们都要"打开数据库"，
 * 且都依赖同一个队列实例（摄取任务与正文写入是同一件事的两面）。
 */

import { ipcMain } from 'electron'
import {
  INGEST_CHANNEL,
  INGEST_METHODS
} from '@shared/contracts/ingest'
import { DOCUMENT_CHANNEL, DOCUMENT_METHODS } from '@shared/contracts/document'
import { getStorage } from './database'
import { DocumentServiceImpl } from './documents'
import { IngestServiceImpl } from '../ingest/service'

/** 单例：摄取服务（队列状态必须全局唯一） */
let ingestService: IngestServiceImpl | null = null
/** 单例：文档服务 */
let documentService: DocumentServiceImpl | null = null

/** 注册摄取 + 文档的 IPC 处理器 */
export function registerIngestIpc(): void {
  const { db } = getStorage()
  ingestService = new IngestServiceImpl(db)
  documentService = new DocumentServiceImpl(db)

  // 上次关应用时还在跑的任务，重开时改成"已暂停"，等用户点继续
  ingestService.runner.recoverAfterRestart()

  registerInvoker(INGEST_CHANNEL, INGEST_METHODS, () => ingestService as unknown as Record<string, unknown>, 'ingest')
  registerInvoker(DOCUMENT_CHANNEL, DOCUMENT_METHODS, () => documentService as unknown as Record<string, unknown>, 'document')
}

/** 取摄取服务（其它主进程模块，比如将来设置页的监控目录恢复，会用到） */
export function getIngestService(): IngestServiceImpl | null {
  return ingestService
}

/**
 * 通用"白名单方法派发"注册器。
 *
 * 抽成一个函数是为了避免三份几乎相同的 IPC 代码——
 * 那种重复最容易出现"改了一处忘了另两处"。
 */
function registerInvoker(
  channel: string,
  methods: readonly string[],
  getTarget: () => Record<string, unknown>,
  label: string
): void {
  const allowed = new Set<string>(methods)
  ipcMain.handle(
    channel,
    async (
      _event,
      method: unknown,
      args: unknown[]
    ): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> => {
      if (typeof method !== 'string' || !allowed.has(method)) {
        return { ok: false, error: `未知的${label}方法：${String(method)}` }
      }
      try {
        const target = getTarget()
        const fn = target[method] as ((...a: unknown[]) => unknown) | undefined
        if (typeof fn !== 'function') {
          return { ok: false, error: `${label}方法不可用：${method}` }
        }
        const data = await fn.apply(target, Array.isArray(args) ? args : [])
        return { ok: true, data }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // eslint-disable-next-line no-console
        console.error(`[${label}] ${method} 失败：`, err)
        return { ok: false, error: msg }
      }
    }
  )
}
