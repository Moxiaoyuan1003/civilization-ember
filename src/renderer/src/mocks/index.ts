/**
 * 服务容器：把各个服务装配成 ServiceRegistry。
 *
 * 这是"可拔插"的接线处，应用启动时调用一次 `initServices()`。
 * 第 8 期起出现**混合装配**：存储层已经是主进程的真 SQLite（走 IPC），
 * 第 9 期起摄取与文档也换成真的（主进程 IPC）。
 * AI / 转写 / 设置 / 媒体仍是内存 Mock，等后续子期逐个替换。
 * 这种"一半真一半假"的中间态是刻意保留的——每期只换一层，坏了好定位。
 */

import type { ServiceRegistry } from '@/services'
import { registerServices } from '@/services'
import { createGraph } from '@/services/graph'
import type { StorageService } from '@shared/contracts/storage'
import { createMockStorage } from './storage'
import { createIpcStorage } from '@/services/storageIpc'
import { createIpcIngest } from '@/services/ingestIpc'
import { createIpcDocument } from '@/services/documentIpc'
import { createMockAi } from './ai'
import { createMockTranscription } from './transcription'
import { createMockIngest } from './ingest'
import { createMockSettings } from './settings'
import { createMockDocument } from './document'
import { createMockMedia } from './media'

/**
 * 创建服务容器。
 * @param storage 存储实现；不传则用内存 Mock（方便在不接主进程的环境里跑）
 */
export function createServices(storage?: StorageService): ServiceRegistry {
  return {
    storage: storage ?? createMockStorage(),
    ai: createMockAi(),
    transcription: createMockTranscription(),
    ingest: createMockIngest(),
    settings: createMockSettings(),
    document: createMockDocument(),
    media: createMockMedia(),
    // 图库直接用真实实现（G6 适配器）；数据层仍是 Mock，
    // 但画布渲染是真实的，页面交互可被真实验证。
    createGraph
  }
}

/**
 * 装配并注入服务（应用启动时调用一次）。
 *
 * 三层桥接各自独立判断：
 * - 存储：主进程 SQLite（IPC）/ 内存 Mock
 * - 摄取：主进程真导入（IPC）/ 内存 Mock（假装跑一遍）
 * - 文档：主进程解析产物（IPC）/ 预置演示文档
 *
 * 为什么能分开判断：如果某天主进程只起了存储没起摄取，
 * 界面应该"库能读、导入不可用"，而不是整页白屏。
 */
export function initServices(): void {
  const hasStorage = Boolean(window.ember?.storageInvoke)
  const hasIngest = Boolean(window.ember?.ingestInvoke)
  const hasDocument = Boolean(window.ember?.documentInvoke)

  const services = createServices(hasStorage ? createIpcStorage() : undefined)
  if (hasIngest) services.ingest = createIpcIngest()
  if (hasDocument) services.document = createIpcDocument()

  registerServices(services)

  // eslint-disable-next-line no-console
  console.log(
    `[bootstrap] 存储层：${hasStorage ? '主进程 SQLite（IPC）' : '内存 Mock（无桥接）'}；` +
      `摄取：${hasIngest ? '主进程（IPC）' : 'Mock'}；` +
      `文档：${hasDocument ? '主进程（IPC）' : 'Mock'}`
  )
}
