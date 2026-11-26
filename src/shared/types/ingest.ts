/**
 * 摄取任务（Ingest Task）类型定义。
 *
 * 摄取 = 把原始载体"变成可检索的知识"的离线批处理流水线：
 * 解析 → OCR → 转写 → 建索引 → （可选）自动建树。
 *
 * 本类型描述"队列里的一条任务"，是管理页摄取队列的数据模型。
 * 关键能力：
 * - 进度（progress 0-1）+ 阶段（stage）：让用户看到"卡在哪一步"。
 * - 断点续传（resumable + checkpoint）：大文件（几 G 的视频、上千页 PDF）
 *   中断后能从上次的阶段继续，不必从头再来。
 * - 重试（attempts/maxAttempts + lastError）：失败任务可手动/自动重试。
 */

/** 摄取流水线的阶段（顺序即执行顺序） */
export type IngestStage =
  | 'queued' // 排队中
  | 'parsing' // 解析文件（PDF/EPUB/网页）
  | 'ocr' // 扫描件 OCR
  | 'transcribing' // 音视频转写
  | 'indexing' // 建全文 + 向量索引
  | 'treeing' // 自动建树（提炼到技术树）
  | 'done' // 完成
  | 'failed' // 失败

/** 摄取任务状态（UI 上的四态） */
export type IngestStatus = 'pending' | 'running' | 'paused' | 'done' | 'failed'

/** 同一时刻只允许一个任务跑（单机批处理），其余排队 */
export interface IngestTask {
  /** 任务 id */
  id: string
  /** 关联的载体 id */
  carrierId: string
  /** 载体标题（冗余一份，列表直接显示，免去再查载体） */
  carrierTitle: string
  /** 载体类型（决定走哪条流水线分支） */
  carrierType: 'book' | 'video' | 'audio' | 'image' | 'webpage'
  /** 当前状态 */
  status: IngestStatus
  /** 当前阶段 */
  stage: IngestStage
  /** 总进度（0-1） */
  progress: number
  /**
   * 断点续传检查点：已完成的阶段列表。
   * 恢复时跳过这些阶段，从第一个未完成的阶段继续。
   */
  checkpoint: IngestStage[]
  /** 是否支持断点续传（本地批处理默认可续；流式采集不可续） */
  resumable: boolean
  /** 已尝试次数 */
  attempts: number
  /** 最大重试次数 */
  maxAttempts: number
  /** 最近一次失败原因 */
  lastError?: string
  /** 排队/开始时间（ISO 字符串） */
  createdAt: string
  /** 最近更新时间（ISO 字符串） */
  updatedAt: string
}

/** 各阶段的中文名（UI 显示用） */
export const INGEST_STAGE_LABELS: Record<IngestStage, string> = {
  queued: '排队中',
  parsing: '解析文件',
  ocr: '文字识别',
  transcribing: '音视频转写',
  indexing: '建立索引',
  treeing: '提炼入树',
  done: '已完成',
  failed: '失败'
}

/** 各状态的中文名 */
export const INGEST_STATUS_LABELS: Record<IngestStatus, string> = {
  pending: '待处理',
  running: '进行中',
  paused: '已暂停',
  done: '已完成',
  failed: '失败'
}

/** 存储占用统计（管理页存储管理区用） */
export interface StorageStats {
  /** 载体总数 */
  carrierCount: number
  /** 原文件总量（字节） */
  originalBytes: number
  /** 索引/中间产物总量（字节） */
  indexBytes: number
  /** 去重节省的字节（内容寻址去重） */
  dedupSavedBytes: number
  /** 按类型的占用明细 */
  byType: { type: string; label: string; bytes: number; count: number }[]
}
