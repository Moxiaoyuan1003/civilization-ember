/**
 * 摄取服务的 IPC 代理（渲染层）。
 *
 * 和 `storageIpc.ts` 同一套路：把契约里的每个方法包成一次 IPC 调用。
 * 手写 14 个方法看起来啰嗦，但比 `Proxy` 动态生成好在两点：
 * 1. 类型是完整的——写错方法名或参数、少一个方法，typecheck 会报；
 * 2. 没有"运行到那一行才发现方法不存在"的隐式失败。
 */

import type { IngestService, ImportOutcome, IngestMethod } from '@shared/contracts/ingest'
import type { IngestTask, StorageStats } from '@shared/types/ingest'

type Envelope = { ok: true; data: unknown } | { ok: false; error: string }

/** 调用主进程摄取服务的一个方法 */
async function call<T>(method: IngestMethod, ...args: unknown[]): Promise<T> {
  const bridge = window.ember?.ingestInvoke
  if (!bridge) {
    throw new Error('摄取功能不可用：未检测到主进程桥接（请在桌面应用中运行）')
  }
  const res = (await bridge(method, args)) as Envelope
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

/** 创建走 IPC 的摄取服务 */
export function createIpcIngest(): IngestService {
  return {
    listTasks: () => call<IngestTask[]>('listTasks'),
    getTask: (id) => call<IngestTask | null>('getTask', id),
    pauseTask: (id) => call<void>('pauseTask', id),
    resumeTask: (id) => call<void>('resumeTask', id),
    retryTask: (id) => call<void>('retryTask', id),
    cancelTask: (id) => call<void>('cancelTask', id),
    getStorageStats: () => call<StorageStats>('getStorageStats'),

    pickFiles: () => call<string[]>('pickFiles'),
    importFiles: (paths) => call<ImportOutcome[]>('importFiles', paths),
    importUrl: (url) => call<ImportOutcome>('importUrl', url),

    pickFolder: () => call<string | null>('pickFolder'),
    watchFolder: (dir) => call<void>('watchFolder', dir),
    unwatchFolder: () => call<void>('unwatchFolder'),
    getWatchedFolder: () => call<string | null>('getWatchedFolder')
  }
}
