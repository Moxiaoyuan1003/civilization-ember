/**
 * Mock 摄取服务（内存实现）。
 *
 * 模拟真实的批处理队列行为：
 * - 暂停 → status='paused'（保留 checkpoint）。
 * - 继续 → status='running'（从 checkpoint 之后的阶段继续）。
 * - 重试 → attempts+1，status='pending'，重新排队。
 * - 取消 → 从列表移除。
 *
 * 不做真正的进度推进（界面演示够用）；真实实现由摄取层进程推送进度。
 */

import type { IngestService } from '@/services/ingest'
import type { IngestTask, StorageStats, IngestStage } from '@/types/ingest'
import { mockIngestTasks } from '@/mocks/data'
import { mockCarriers } from '@/mocks/data'

/** 流水线阶段顺序（断点续传时用来找"下一个未完成的阶段"） */
const STAGE_ORDER: IngestStage[] = [
  'queued',
  'parsing',
  'ocr',
  'transcribing',
  'indexing',
  'treeing',
  'done'
]

/** 载体类型 → 该类型会走哪些阶段 */
function stagesForType(type: IngestTask['carrierType']): IngestStage[] {
  switch (type) {
    case 'video':
    case 'audio':
      // 音视频：解析 → 转写 → 索引 → 建树
      return ['parsing', 'transcribing', 'indexing', 'treeing']
    case 'book':
      // 书：解析 → OCR → 索引 → 建树
      return ['parsing', 'ocr', 'indexing', 'treeing']
    case 'image':
      // 图片：OCR → 索引
      return ['ocr', 'indexing']
    case 'webpage':
      // 网页：解析 → 索引 → 建树
      return ['parsing', 'indexing', 'treeing']
    default:
      return ['parsing', 'indexing']
  }
}

export function createMockIngest(): IngestService {
  // 可变副本，让暂停/继续/重试立刻在 UI 生效
  const tasks: IngestTask[] = structuredClone(mockIngestTasks)

  /** 找任务 */
  function find(id: string): IngestTask | undefined {
    return tasks.find((t) => t.id === id)
  }

  /** 更新某任务的更新时间为当前时刻 */
  function touch(task: IngestTask): void {
    task.updatedAt = new Date().toISOString()
  }

  return {
    async listTasks(): Promise<IngestTask[]> {
      // 按创建时间倒序（最新的在前）
      return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async getTask(id: string): Promise<IngestTask | null> {
      return find(id) ?? null
    },

    async pauseTask(id: string): Promise<void> {
      const t = find(id)
      if (!t) return
      // 只有进行中/待处理的任务能暂停
      if (t.status === 'running' || t.status === 'pending') {
        t.status = 'paused'
        touch(t)
      }
    },

    async resumeTask(id: string): Promise<void> {
      const t = find(id)
      if (!t) return
      if (t.status !== 'paused' && t.status !== 'failed') return

      // 断点续传：从第一个未落在 checkpoint 里的阶段继续
      const pipeline = stagesForType(t.carrierType)
      const nextStage = pipeline.find((s) => !t.checkpoint.includes(s))
      t.status = 'running'
      t.stage = nextStage ?? 'done'
      // 继续时把进度退回到该阶段的起点（粗略模拟）
      t.progress = Math.min(t.progress, 0.05)
      touch(t)
    },

    async retryTask(id: string): Promise<void> {
      const t = find(id)
      if (!t) return
      if (t.status !== 'failed' && t.status !== 'paused') return

      t.attempts += 1
      // 重置为待处理，重新排队；checkpoint 保留 → 已完成阶段不重跑
      t.status = 'pending'
      t.stage = 'queued'
      t.lastError = undefined
      touch(t)
    },

    async cancelTask(id: string): Promise<void> {
      const idx = tasks.findIndex((t) => t.id === id)
      // 只从队列移除，不动载体本身
      if (idx >= 0) tasks.splice(idx, 1)
    },

    async getStorageStats(): Promise<StorageStats> {
      // 用 mockCarriers 的真实字段算（原文件大小从 sizeBytes 来）
      const originals = mockCarriers.reduce((sum, c) => sum + (c.sizeBytes ?? 0), 0)

      // 按类型统计
      const byTypeMap = new Map<string, { bytes: number; count: number }>()
      for (const c of mockCarriers) {
        const cur = byTypeMap.get(c.type) ?? { bytes: 0, count: 0 }
        cur.bytes += c.sizeBytes ?? 0
        cur.count += 1
        byTypeMap.set(c.type, cur)
      }

      const TYPE_LABELS: Record<string, string> = {
        book: '书',
        video: '视频',
        audio: '音频',
        image: '图片',
        webpage: '网页'
      }

      const byType = [...byTypeMap.entries()].map(([type, v]) => ({
        type,
        label: TYPE_LABELS[type] ?? type,
        bytes: v.bytes,
        count: v.count
      }))

      return {
        carrierCount: mockCarriers.length,
        originalBytes: originals,
        // 索引体积粗略按原文件的 8% 估
        indexBytes: Math.round(originals * 0.08),
        // 演示：假装去重省下了 3%，真实实现按 contentHash 去重实际计算
        dedupSavedBytes: Math.round(originals * 0.03),
        byType
      }
    }
  }
}
