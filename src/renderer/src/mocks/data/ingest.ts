/**
 * Mock 摄取队列数据。
 *
 * 覆盖多种状态，方便管理页把每种 UI 分支都跑到：
 * - 一个进行中（转写阶段，断点可续）
 * - 一个排队中（刚入库）
 * - 一个已暂停（用户手动暂停，可续）
 * - 一个失败（OCR 失败，可重试）
 * - 一个已完成
 */

import type { IngestTask } from '@/types/ingest'

/** Mock 摄取任务列表 */
export const mockIngestTasks: IngestTask[] = [
  {
    id: 'task-1',
    carrierId: 'c-video-fire',
    carrierTitle: '钻木取火：原始技术的复原实验',
    carrierType: 'video',
    status: 'running',
    stage: 'transcribing',
    progress: 0.42,
    checkpoint: ['parsing'],
    resumable: true,
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-02-10T08:12:30Z'
  },
  {
    id: 'task-2',
    carrierId: 'c-book-metallurgy',
    carrierTitle: '冶金原理（第 3 版）',
    carrierType: 'book',
    status: 'running',
    stage: 'indexing',
    progress: 0.78,
    checkpoint: ['parsing', 'ocr'],
    resumable: true,
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2026-02-10T07:30:00Z',
    updatedAt: '2026-02-10T08:10:00Z'
  },
  {
    id: 'task-3',
    carrierId: 'c-audio-iron',
    carrierTitle: '冶铁口述史：老匠人访谈',
    carrierType: 'audio',
    status: 'pending',
    stage: 'queued',
    progress: 0,
    checkpoint: [],
    resumable: true,
    attempts: 0,
    maxAttempts: 3,
    createdAt: '2026-02-10T08:15:00Z',
    updatedAt: '2026-02-10T08:15:00Z'
  },
  {
    id: 'task-4',
    carrierId: 'c-web-charcoal',
    carrierTitle: '木炭烧制工艺百科（网页存档）',
    carrierType: 'webpage',
    status: 'paused',
    stage: 'parsing',
    progress: 0.31,
    checkpoint: [],
    resumable: true,
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2026-02-10T06:00:00Z',
    updatedAt: '2026-02-10T06:20:00Z'
  },
  {
    id: 'task-5',
    carrierId: 'c-book-survival',
    carrierTitle: '野外生存手册（扫描版）',
    carrierType: 'book',
    status: 'failed',
    stage: 'failed',
    progress: 0.55,
    checkpoint: ['parsing'],
    resumable: true,
    attempts: 3,
    maxAttempts: 3,
    lastError: 'OCR 引擎超时：第 211 页图像分辨率过低，识别失败',
    createdAt: '2026-02-09T20:00:00Z',
    updatedAt: '2026-02-10T05:40:00Z'
  },
  {
    id: 'task-6',
    carrierId: 'c-book-steam',
    carrierTitle: '蒸汽机原理与构造',
    carrierType: 'book',
    status: 'done',
    stage: 'done',
    progress: 1,
    checkpoint: ['parsing', 'ocr', 'indexing', 'treeing'],
    resumable: true,
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2026-02-09T10:00:00Z',
    updatedAt: '2026-02-09T10:45:00Z'
  }
]
