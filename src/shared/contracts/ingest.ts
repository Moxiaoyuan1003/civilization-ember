/**
 * 摄取服务契约（渲染层与主进程共用）。
 *
 * 与 `storage.ts` 同样的思路：接口定义放 shared，主进程实现真逻辑，
 * 渲染层拿一份 IPC 代理。区别在于摄取天然是"有副作用、要碰文件系统"的，
 * 所以它能做的事情比存储层更"动作化"（选文件、抓网页、监视目录）。
 *
 * 分期实现的现实：
 * 第 9 期做的是"**把文件真的收进库**"——算哈希、去重、复制进对象仓、
 * 建载体记录、跑任务队列。文本解析（PDF/EPUB 抽正文）是第 10 期，
 * 转写是第 13 期，OCR 是第 15 期。
 *
 * 因此任务跑到"解析"这一步时会明确标注 skippedStages，
 * 而不是假装成功——用户应该看到"入库了，但正文还没解析"。
 */

import type { IngestTask, StorageStats } from '@shared/types/ingest'

/** 单次导入的结果（一个文件一条，方便前端逐条提示） */
export interface ImportOutcome {
  /** 是否成功 */
  ok: boolean
  /** 成功时：新建（或复用）的载体 id */
  carrierId?: string
  /** 载体标题 */
  title?: string
  /** 新建的摄取任务 id */
  taskId?: string
  /**
   * 命中重复时：库里已有载体的 id。
   * 内容哈希相同即视为同一份东西，不再重复入库。
   */
  duplicateOf?: string
  /** 失败原因 */
  error?: string
}

/** 支持导入的文件扩展名（第 9 期能收进库的） */
export const INGEST_FILE_EXTENSIONS = [
  '.pdf',
  '.epub',
  '.txt',
  '.md',
  '.mp4',
  '.mkv',
  '.mov',
  '.webm',
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp'
] as const

export interface IngestService {
  /** 列出全部摄取任务（按创建时间倒序） */
  listTasks(): Promise<IngestTask[]>
  /** 按 id 取单个任务 */
  getTask(id: string): Promise<IngestTask | null>
  /** 暂停任务（保留 checkpoint，可续） */
  pauseTask(id: string): Promise<void>
  /** 继续任务（从第一个未完成的阶段开始，断点续传） */
  resumeTask(id: string): Promise<void>
  /** 重试失败任务（attempts+1，checkpoint 保留） */
  retryTask(id: string): Promise<void>
  /** 取消任务（从队列移除，不删载体） */
  cancelTask(id: string): Promise<void>
  /** 存储占用统计 */
  getStorageStats(): Promise<StorageStats>

  /* ---------- 第 9 期新增：真导入 ---------- */

  /** 弹系统文件选择框，返回用户选中的绝对路径（取消则空数组） */
  pickFiles(): Promise<string[]>
  /** 导入一批本地文件（算哈希、去重、复制进库、建载体与任务） */
  importFiles(paths: string[]): Promise<ImportOutcome[]>
  /** 导入一个网页（抓正文 + 下载图片存库） */
  importUrl(url: string): Promise<ImportOutcome>

  /* ---------- 监控文件夹 ---------- */

  /** 弹目录选择框，返回目录绝对路径（取消则 null） */
  pickFolder(): Promise<string | null>
  /** 开始监视一个目录，丢进去的文件自动入库 */
  watchFolder(dir: string): Promise<void>
  /** 停止监视 */
  unwatchFolder(): Promise<void>
  /** 当前正在监视的目录（没监视则 null） */
  getWatchedFolder(): Promise<string | null>
}

/** IPC 通道名 */
export const INGEST_CHANNEL = 'ingest:invoke'

/**
 * 方法白名单（主进程校验用）。
 * 与 STORAGE_METHODS 同理：单一通道 + 方法名分发，避免 27 个通道名写三遍漏一个。
 */
export const INGEST_METHODS = [
  'listTasks',
  'getTask',
  'pauseTask',
  'resumeTask',
  'retryTask',
  'cancelTask',
  'getStorageStats',
  'pickFiles',
  'importFiles',
  'importUrl',
  'pickFolder',
  'watchFolder',
  'unwatchFolder',
  'getWatchedFolder'
] as const

export type IngestMethod = (typeof INGEST_METHODS)[number]
