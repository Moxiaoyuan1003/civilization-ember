/**
 * 摄取服务接口（Ingest Service）。
 *
 * 管理页"摄取任务队列"的数据来源。真实实现里，这层会通过 IPC 与
 * 离线的摄取层进程（Python 伴生进程）通信；渲染层只认这个接口。
 *
 * 关键能力（对应第 6 期的需求）：
 * - 列出队列 / 单任务进度。
 * - 暂停、继续（断点续传）、重试、取消。
 * - 存储占用统计。
 */

import type { IngestTask, StorageStats } from '@/types/ingest'

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
}
