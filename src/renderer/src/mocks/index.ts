/**
 * 服务容器：把各个服务装配成 ServiceRegistry。
 *
 * 这是"可拔插"的接线处，应用启动时调用一次 `initServices()`。
 * 第 8 期起出现**混合装配**：存储层已经是主进程的真 SQLite（走 IPC），
 * 而 AI / 转写 / 摄取 / 设置 / 文档 / 媒体仍是内存 Mock，等后续子期逐个替换。
 * 这种"一半真一半假"的中间态是刻意保留的——每期只换一层，坏了好定位。
 */

import type { ServiceRegistry } from '@/services'
import { registerServices } from '@/services'
import { createGraph } from '@/services/graph'
import type { StorageService } from '@shared/contracts/storage'
import { createMockStorage } from './storage'
import { createIpcStorage } from '@/services/storageIpc'
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
 * 存储层优先走主进程：检测到 preload 暴露的 `storageInvoke` 就用 IPC 版，
 * 否则退回内存 Mock —— 这样把渲染层单独丢进浏览器预览时页面也不会白屏。
 */
export function initServices(): void {
  const hasBridge = Boolean(window.ember?.storageInvoke)
  registerServices(createServices(hasBridge ? createIpcStorage() : undefined))
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] 存储层：${hasBridge ? '主进程 SQLite（IPC）' : '内存 Mock（无桥接）'}`)
}
