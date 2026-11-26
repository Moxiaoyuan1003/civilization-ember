/**
 * 摄取任务队列的持久化读写（主进程）。
 *
 * 与 8 期的内存 Mock 的区别：这里落库。
 * 为什么必须落库——真实摄取可能跑几十分钟（一小时的口述史转写要 20 分钟），
 * 用户很可能中途关窗口、或者应用崩一次。队列在磁盘上，
 * 重开时才能看到"上次跑到哪一步、卡在哪个阶段"。
 */

import type { Database } from 'node-sqlite3-wasm'
import type { IngestStage, IngestTask, StorageStats } from '@shared/types/ingest'
import {
  ingestTaskFromRow,
  ingestTaskToParams,
  type Row
} from './rowmap'

/** 载体类型 → 该类型要走哪些阶段（顺序即执行顺序） */
export function stagesForType(type: IngestTask['carrierType']): IngestStage[] {
  switch (type) {
    case 'video':
    case 'audio':
      return ['parsing', 'transcribing', 'indexing', 'treeing']
    case 'book':
      return ['parsing', 'ocr', 'indexing', 'treeing']
    case 'image':
      return ['ocr', 'indexing']
    case 'webpage':
      return ['parsing', 'indexing', 'treeing']
    default:
      return ['parsing', 'indexing']
  }
}

/** 找流水线里下一个未完成的阶段（checkpoint 里没有的） */
export function nextStageOf(task: IngestTask): IngestStage | null {
  const pipeline = stagesForType(task.carrierType)
  return pipeline.find((s) => !task.checkpoint.includes(s)) ?? null
}

export class IngestRepo {
  constructor(private readonly db: Database) {}

  list(): IngestTask[] {
    const rows = this.db.all(
      `SELECT * FROM ingest_tasks ORDER BY created_at DESC`
    ) as Row[]
    return rows.map(ingestTaskFromRow)
  }

  get(id: string): IngestTask | null {
    const row = this.db.get(`SELECT * FROM ingest_tasks WHERE id = ?`, [id]) as Row | null
    return row ? ingestTaskFromRow(row) : null
  }

  /** 写入或更新一条任务 */
  save(task: IngestTask): void {
    this.db.run(
      `INSERT INTO ingest_tasks (
         id, carrier_id, carrier_title, carrier_type, status, stage, progress,
         checkpoint, skipped_stages, note, resumable, attempts, max_attempts,
         last_error, created_at, updated_at
       ) VALUES (
         :id, :carrier_id, :carrier_title, :carrier_type, :status, :stage, :progress,
         :checkpoint, :skipped_stages, :note, :resumable, :attempts, :max_attempts,
         :last_error, :created_at, :updated_at
       )
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status, stage=excluded.stage, progress=excluded.progress,
         checkpoint=excluded.checkpoint, skipped_stages=excluded.skipped_stages,
         note=excluded.note, resumable=excluded.resumable,
         attempts=excluded.attempts, max_attempts=excluded.max_attempts,
         last_error=excluded.last_error, updated_at=excluded.updated_at`,
      ingestTaskToParams(task)
    )
  }

  remove(id: string): void {
    this.db.run(`DELETE FROM ingest_tasks WHERE id = ?`, [id])
  }

  /** 某个载体是否已有排队中/进行中的任务（防重复入队） */
  findActiveByCarrier(carrierId: string): IngestTask | null {
    const row = this.db.get(
      `SELECT * FROM ingest_tasks
       WHERE carrier_id = ? AND status IN ('pending','running','paused')
       ORDER BY created_at DESC LIMIT 1`,
      [carrierId]
    ) as Row | null
    return row ? ingestTaskFromRow(row) : null
  }

  /**
   * 存储占用统计。
   *
   * 这里算的是**真实数字**，不再像一期那样用 8% / 3% 拍脑袋估：
   * - originalBytes：objects 表里登记的对象总字节（真去重后的实际占用）
   * - dedupSavedBytes：carriers 里引用的总大小 - 实际对象大小
   *   （同一份文件被导入两次，第二份不占磁盘，差值就是省下的）
   * - indexBytes：documents/transcripts 的文本字节，粗略当"索引"体积
   */
  stats(): StorageStats {
    const carriers = this.db.all(`SELECT type, size_bytes, object_hash FROM carriers`) as Row[]

    const byTypeMap = new Map<string, { bytes: number; count: number }>()
    let carrierBytesTotal = 0
    /** 只统计"真入库"的载体（有 object_hash）声明大小之和 */
    let realCarrierBytes = 0
    for (const row of carriers) {
      const type = String(row.type)
      const size = Number(row.size_bytes) || 0
      const cur = byTypeMap.get(type) ?? { bytes: 0, count: 0 }
      cur.bytes += size
      cur.count += 1
      byTypeMap.set(type, cur)
      carrierBytesTotal += size
      if (row.object_hash) realCarrierBytes += size
    }

    // 真实对象占用（内容寻址去重后的实际磁盘字节）
    const objRow = this.db.get(`SELECT COALESCE(SUM(size_bytes),0) AS total FROM objects`) as
      | { total: number }
      | null
    const objectBytes = Number(objRow?.total) || 0

    // 索引体积：正文与转写的文本量（按 UTF-8 字节粗算 3 字节/汉字）
    const docRow = this.db.get(
      `SELECT COALESCE(SUM(LENGTH(pages)),0) AS len FROM documents`
    ) as { len: number } | null
    const transcriptRow = this.db.get(
      `SELECT COALESCE(SUM(LENGTH(raw_text)),0) AS len FROM transcripts`
    ) as { len: number } | null
    const textLen = (Number(docRow?.len) || 0) + (Number(transcriptRow?.len) || 0)

    const TYPE_LABELS: Record<string, string> = {
      book: '书',
      video: '视频',
      audio: '音频',
      image: '图片',
      webpage: '网页'
    }

    return {
      carrierCount: carriers.length,
      // 原文件总量优先用真实对象占用；还没有真实对象时退回载体声明的大小（演示数据）
      originalBytes: objectBytes > 0 ? objectBytes : carrierBytesTotal,
      indexBytes: textLen * 3,
      /*
       * 去重节省 = 「真实入库载体的声明大小之和」- 「对象仓实际占用」。
       *
       * 为什么分子只算有 object_hash 的载体：演示数据（一期的 7 个假载体）
       * 有 sizeBytes 却没有对象，把它们算进来会让"去重省下 106MB"这种数字凭空出现——
       * 那是假数据，不是去重的功劳。宁可数字小一点，也要它是真的。
       */
      dedupSavedBytes: Math.max(0, realCarrierBytes - objectBytes),
      byType: [...byTypeMap.entries()].map(([type, v]) => ({
        type,
        label: TYPE_LABELS[type] ?? type,
        bytes: v.bytes,
        count: v.count
      }))
    }
  }
}
