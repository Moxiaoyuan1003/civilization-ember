/**
 * 服务注册中心（Service Registry）。
 *
 * 渲染层不直接 new 具体实现，而是从这里的单例拿服务。
 * 好处（对应"可拔插、换后端不动页面"）：
 * - 开发期注入 Mock 实现，生产期注入真实实现，页面代码零改动。
 * - 未来接 Electron IPC / HTTP 时，只换这里的注入逻辑。
 */

import type { StorageService } from './storage'
import type { AiService } from './ai'
import type { TranscriptionService } from './transcription'
import type { GraphService, GraphEngine } from './graph'
import type { IngestService } from './ingest'
import type { SettingsService } from './settings'
import type { DocumentService } from './document'
import type { MediaService } from './media'

/** 服务容器：八个抽象服务的单例 */
export interface ServiceRegistry {
  storage: StorageService
  ai: AiService
  transcription: TranscriptionService
  /** 摄取队列（管理页用） */
  ingest: IngestService
  /** 整机级设置（AI / 转写 / 存储） */
  settings: SettingsService
  /** 文档解析产物（阅读器的数据源：书 → 页） */
  document: DocumentService
  /** 音视频来源解析（播放器的数据源：载体 → 可播地址 / 只有转写） */
  media: MediaService
  /** 图库按引擎创建（可换 G6/Cytoscape/Sigma） */
  createGraph(engine: GraphEngine): GraphService
}

/** 全局服务容器单例（各页面/composables 从这里取） */
let registry: ServiceRegistry | null = null

/** 注入服务容器（应用启动时调用一次） */
export function registerServices(r: ServiceRegistry): void {
  registry = r
}

/** 取服务容器；未注入时抛错（防止误用） */
export function useServices(): ServiceRegistry {
  if (!registry) throw new Error('服务容器尚未注入：请先在应用启动时调用 registerServices')
  return registry
}
