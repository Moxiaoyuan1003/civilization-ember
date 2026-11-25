/**
 * Mock 服务容器：把四个 Mock 服务装配成 ServiceRegistry。
 *
 * 这是"可拔插"的接线处：应用启动时调用 registerServices(createMockServices())，
 * 后续换真实后端时，只改这一处（注入真实实现），页面代码零改动。
 */

import type { ServiceRegistry } from '@/services'
import { registerServices } from '@/services'
import { createGraph } from '@/services/graph'
import { createMockStorage } from './storage'
import { createMockAi } from './ai'
import { createMockTranscription } from './transcription'
import { createMockIngest } from './ingest'
import { createMockSettings } from './settings'
import { createMockDocument } from './document'
import { createMockMedia } from './media'

/** 创建完整的 Mock 服务容器 */
export function createMockServices(): ServiceRegistry {
  return {
    storage: createMockStorage(),
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

/** 注入 Mock 服务（应用启动时调用一次） */
export function initMockServices(): void {
  registerServices(createMockServices())
}
