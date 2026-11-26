/**
 * 摄取任务运行器（主进程）。
 *
 * 职责：把队列里的任务按顺序跑完，把每次进展**立刻写回数据库**。
 *
 * 三条刻意的设计：
 *
 * 1. **同一时刻只跑一个任务**。
 *    单机批处理，并行跑只会让磁盘和 CPU 互相抢，进度条也不再可信。
 *    用户看到的是"一次专心做一件事"。
 *
 * 2. **每个阶段结束就落库**，不是全部跑完才写。
 *    这样应用被强杀，重开也能看到"解析完了、卡在索引"，
 *    而不是显示成什么都没发生。断点续传靠的就是这个 checkpoint。
 *
 * 3. **没实现的阶段如实标 skippedStages，不假装成功**。
 *    第 9 期能真做的是：入库存原文件、纯文本/网页正文解析与建索引。
 *    PDF/EPUB 解析（第 10 期）、转写（第 13 期）、OCR（第 15 期）都还没实现，
 *    任务会明确写"这些阶段跳过了，等第几期"。
 *    假装完成会让用户以为"书能读了"，点进去却是空白——那比诚实标注糟得多。
 */

import type { Database } from 'node-sqlite3-wasm'
import type { IngestStage, IngestTask } from '@shared/types/ingest'
import { IngestRepo, nextStageOf, stagesForType } from '../storage/ingestRepo'
import { DocumentRepo } from '../storage/documents'
import { objectFilePath } from '../storage/objects'
import { paginateText } from './paginate'
import { extractPdf } from './pdf'
import { extractEpub } from './epub'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/** 各阶段是否已实现（能力边界就写在这张表里） */
const STAGE_IMPLEMENTED: Record<IngestStage, boolean> = {
  queued: true,
  parsing: true, // 第 10 期：TXT/MD/PDF/EPUB/网页全支持
  ocr: false, // 第 15 期
  transcribing: false, // 第 13 期
  indexing: true, // 正文驱动的关键词索引（第 12 期升级为倒排 + BM25）
  treeing: false, // 第 16 期（且只做"AI 建议、人确认"）
  done: true,
  failed: true
}

/** 模拟每一步的耗时（真实解析很快，但让界面进度条有过程感） */
const STEP_DELAY_MS = 220

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class IngestRunner {
  private readonly repo: IngestRepo
  private readonly docs: DocumentRepo
  /** 当前在跑的任务 id（null = 空闲） */
  private runningId: string | null = null
  /** 是否有挂起的"该继续跑队列"请求 */
  private draining = false

  constructor(private readonly db: Database) {
    this.repo = new IngestRepo(db)
    this.docs = new DocumentRepo(db)
  }

  /** 新建一条任务并塞进队列（不立刻执行） */
  enqueue(carrierId: string, carrierTitle: string, carrierType: IngestTask['carrierType']): IngestTask {
    const now = new Date().toISOString()
    const task: IngestTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      carrierId,
      carrierTitle,
      carrierType,
      status: 'pending',
      stage: 'queued',
      progress: 0,
      checkpoint: [],
      skippedStages: [],
      resumable: true,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now
    }
    this.repo.save(task)
    // 入队后尝试启动（异步，不阻塞调用方）
    void this.drain()
    return task
  }

  /** 空闲就取出最早一条 pending 任务开跑 */
  private async drain(): Promise<void> {
    if (this.draining || this.runningId) return
    this.draining = true
    try {
      // 找到最早一条待处理的
      const pending = this.repo
        .list()
        .filter((t) => t.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      if (!pending) return
      this.draining = false
      await this.runTask(pending.id)
    } finally {
      this.draining = false
    }
  }

  /** 跑完指定任务的全部阶段 */
  private async runTask(id: string): Promise<void> {
    const task = this.repo.get(id)
    if (!task) return

    this.runningId = id
    this.patch(id, { status: 'running', lastError: undefined })

    try {
      const pipeline = stagesForType(task.carrierType)
      for (const stage of pipeline) {
        // 每次循环都重读最新状态：用户可能刚点了暂停
        const current = this.repo.get(id)
        if (!current) return // 被取消了
        if (current.status === 'paused') return // 暂停：留着 checkpoint，下次续
        if (current.checkpoint.includes(stage)) continue // 断点续传：跳过已完成

        // 该阶段还没实现 → 记进 skippedStages，继续下一个
        if (!STAGE_IMPLEMENTED[stage]) {
          const skipped = [...new Set([...current.skippedStages, stage])]
          this.patch(id, {
            stage,
            skippedStages: skipped,
            note: `${SKIP_NOTE[stage] ?? '该阶段尚未实现'}（任务本身已完成入库）`
          })
          await delay(STEP_DELAY_MS)
          continue
        }

        this.patch(id, { stage, progress: stageProgress(pipeline, stage, 0) })
        await this.executeStage(id, stage, current)
      }

      // 全部阶段走完
      const finalTask = this.repo.get(id)
      if (!finalTask) return
      if (finalTask.status === 'paused') return
      const note =
        finalTask.skippedStages.length > 0
          ? `已入库；${finalTask.skippedStages.map((s) => SKIP_NOTE[s] ?? s).join('、')}`
          : undefined
      this.patch(id, { status: 'done', stage: 'done', progress: 1, note })
      // 任务完成 → 载体的状态也要跟着改。
      // 不改就会一直显示"待摄取"，首页统计和图书馆列表都在说假话：
      // 明明已经入库解析完了，用户看到的还是"还没处理"。
      this.setCarrierStatus(finalTask.carrierId, 'ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const cur = this.repo.get(id)
      this.patch(id, {
        status: cur && cur.attempts < cur.maxAttempts ? 'failed' : 'failed',
        stage: 'failed',
        lastError: msg
      })
      // 解析失败也要如实反映到载体上：原件在库里，但内容读不出来，
      // 标 failed 而不是 ready，否则用户点开是空白会以为软件坏了。
      if (cur) this.setCarrierStatus(cur.carrierId, 'failed')
      console.error(`[ingest] 任务 ${id} 失败：`, msg)
    } finally {
      this.runningId = null
      // 队列里还有就接着跑
      void this.drain()
    }
  }

  /** 执行单个阶段 */
  private async executeStage(id: string, stage: IngestStage, task: IngestTask): Promise<void> {
    switch (stage) {
      case 'parsing': {
        await this.doParse(task, (p) => this.patch(id, { progress: stageProgress(stagesForType(task.carrierType), stage, p) }))
        break
      }
      case 'indexing': {
        // 第 9 期的"索引"= 确认正文已入 documents 表（供阅读器与朴素搜索用）
        await delay(STEP_DELAY_MS)
        const doc = this.docs.get(task.carrierId)
        if (!doc) {
          // 没有正文可索引（音视频还没转写、图片还没 OCR）→ 不报错，标跳过
          const cur = this.repo.get(id)
          if (cur) {
            const skipped: IngestStage[] = [...new Set<IngestStage>([...cur.skippedStages, 'indexing'])]
            this.patch(id, {
              skippedStages: skipped,
              note: '暂无可索引的正文（音视频要等第 13 期转写、图片要等第 15 期文字识别）'
            })
          }
        }
        break
      }
      default:
        await delay(STEP_DELAY_MS)
        break
    }

    // 阶段完成 → 记进 checkpoint
    const cur = this.repo.get(id)
    if (!cur) return
    this.patch(id, {
      checkpoint: [...new Set([...cur.checkpoint, stage])],
      progress: stageProgress(stagesForType(cur.carrierType), stage, 1)
    })
  }

  /**
   * 真解析：把载体对应的原文件读出来切页。
   *
   * 第 10 期已支持：
   * - 纯文本 / Markdown → 按字数装箱
   * - PDF → 逐页抽文字（扫描版如实报需要 OCR）
   * - EPUB → 按 spine 顺序逐章抽正文
   * - 网页 → 抓取时已解析，这里只确认
   *
   * 尚未支持的格式（音视频转写、图片 OCR）会明确抛错，
   * 让任务标失败而不是静默假成功——用户点开书看到空白，
   * 比看到"解析失败：这个格式还没接入"更糟。
   */
  private async doParse(task: IngestTask, onProgress: (p: number) => void): Promise<void> {
    const row = this.db.get(`SELECT * FROM carriers WHERE id = ?`, [task.carrierId]) as
      | Record<string, string | number | null>
      | null
    if (!row) throw new Error('载体不存在')

    const format = String(row.format ?? '').toLowerCase()
    const objectHash = row.object_hash === null ? null : String(row.object_hash)

    // 网页：正文在抓取时就已解析并写进 documents，这里只确认
    if (task.carrierType === 'webpage') {
      onProgress(1)
      return
    }

    if (!objectHash) throw new Error('这个载体没有原文件（演示数据），无法解析')
    const filePath = objectFilePath(objectHash)
    if (!filePath || !existsSync(filePath)) throw new Error('原文件在对象仓里找不到了')

    /* ---- 纯文本类 ---- */
    const isText = format === 'txt' || format === 'md' || format === 'markdown' || format === 'text'
    if (isText) {
      onProgress(0.3)
      const raw = await readFile(filePath, 'utf8')
      onProgress(0.6)
      const doc = paginateText(task.carrierId, raw, task.carrierTitle)
      this.docs.save(doc)
      this.noteParsed(task.carrierId, doc.pages.length, 0)
      onProgress(1)
      return
    }

    /* ---- PDF ---- */
    if (format === 'pdf') {
      const result = await extractPdf(task.carrierId, filePath, task.carrierTitle, (r) =>
        onProgress(0.1 + r * 0.85)
      )
      if (!result.doc) {
        // 整本都是扫描页：如实报"需要 OCR"，别给用户一本白页书
        throw new Error(
          `这是一本扫描版 PDF（${result.totalPages} 页里 ${result.scannedPages} 页没有文字层）：需要文字识别才能读，第 15 期接入`
        )
      }
      this.docs.save(result.doc)
      this.noteParsed(task.carrierId, result.doc.pages.length, result.scannedPages)
      onProgress(1)
      return
    }

    /* ---- EPUB ---- */
    if (format === 'epub') {
      const result = await extractEpub(task.carrierId, filePath, task.carrierTitle, (r) =>
        onProgress(0.1 + r * 0.85)
      )
      if (!result.doc) {
        throw new Error(result.reason ?? '这本 EPUB 里没有可读的文字')
      }
      this.docs.save(result.doc)
      this.noteParsed(task.carrierId, result.doc.pages.length, 0)
      onProgress(1)
      return
    }

    /* ---- 还没接入的格式，如实报错 ---- */
    throw new Error(
      `暂不支持解析 ${format || '该'} 格式：${
        task.carrierType === 'video' || task.carrierType === 'audio'
          ? '音视频转写在第 13 期接入'
          : '图片文字识别在第 15 期接入'
      }（原文件已安全入库存好，不会丢）`
    )
  }

  /** 把解析结果的规模写进 carriers.description，图书馆列表能直接看出来 */
  private noteParsed(carrierId: string, pageCount: number, scannedPages: number): void {
    try {
      const note =
        scannedPages > 0
          ? `已解析 ${pageCount} 页（其中 ${scannedPages} 页是扫描图，暂未识别）`
          : `已解析 ${pageCount} 页`
      this.db.run(`UPDATE carriers SET description = ? WHERE id = ?`, [note, carrierId])
    } catch (err) {
      // 写说明失败不该让解析本身判失败：正文已经在 documents 表里了
      console.error('[ingest] 写解析说明失败：', err)
    }
  }

  /** 更新任务字段（自动刷 updatedAt） */
  private patch(id: string, fields: Partial<IngestTask>): void {
    const cur = this.repo.get(id)
    if (!cur) return
    this.repo.save({ ...cur, ...fields, updatedAt: new Date().toISOString() })
  }

  /**
   * 同步载体的摄取状态。
   *
   * 任务表和载体表是两张表、两个视角：任务表讲"这次处理跑到哪了"，
   * 载体表讲"这个载体整体能不能用"。首页统计、图书馆列表筛的都是载体表的 status，
   * 只改任务表不改载体表，界面就会自相矛盾。
   */
  private setCarrierStatus(carrierId: string, status: 'ready' | 'failed'): void {
    try {
      this.db.run(
        `UPDATE carriers SET status = ?, ingested_at = ? WHERE id = ?`,
        [status, status === 'ready' ? new Date().toISOString() : null, carrierId]
      )
    } catch (err) {
      // 状态同步失败不该让任务本身判失败：内容已经存好了，下次刷新还能修正
      console.error('[ingest] 同步载体状态失败：', err)
    }
  }

  /* ------------------------- 用户操作 ------------------------- */

  pause(id: string): void {
    this.patch(id, { status: 'paused' })
  }

  resume(id: string): void {
    const task = this.repo.get(id)
    if (!task) return
    // 续跑：状态回 pending，让 drain 接着执行（checkpoint 会跳过已完成阶段）
    this.patch(id, { status: 'pending', stage: nextStageOf(task) ?? 'queued', lastError: undefined })
    void this.drain()
  }

  retry(id: string): void {
    const task = this.repo.get(id)
    if (!task) return
    this.patch(id, {
      status: 'pending',
      stage: nextStageOf(task) ?? 'queued',
      attempts: task.attempts + 1,
      lastError: undefined
    })
    void this.drain()
  }

  cancel(id: string): void {
    // 正在跑的任务：先标取消（runTask 每阶段会重读状态），再删记录
    const task = this.repo.get(id)
    if (!task) return
    if (this.runningId === id) {
      this.patch(id, { status: 'paused' })
    }
    this.repo.remove(id)
  }

  /** 应用启动时调用：把上次没跑完的 running 任务改成 paused（等用户手动继续） */
  recoverAfterRestart(): void {
    for (const task of this.repo.list()) {
      if (task.status === 'running') {
        this.patch(task.id, {
          status: 'paused',
          note: '上次应用关闭时任务在运行，已暂停。点「继续」可从断点接着跑。'
        })
      }
    }
  }
}

/** 未实现阶段的说明文案（管理页直接显示） */
const SKIP_NOTE: Record<IngestStage, string> = {
  queued: '排队中',
  parsing: '解析',
  ocr: '文字识别（第 15 期接入）',
  transcribing: '音视频转写（第 13 期接入）',
  indexing: '建立索引',
  treeing: '自动入树（第 16 期接入）',
  done: '完成',
  failed: '失败'
}

/** 某阶段在流水线里的整体进度（stage 起点 + 该阶段内部进度 × 阶段占比） */
function stageProgress(pipeline: IngestStage[], stage: IngestStage, inner: number): number {
  const idx = pipeline.indexOf(stage)
  if (idx < 0) return 0
  return Math.min(0.99, (idx + inner) / pipeline.length)
}
