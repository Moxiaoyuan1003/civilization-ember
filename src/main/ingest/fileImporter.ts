/**
 * 文件导入器（主进程）。
 *
 * 一条导入链路的完整动作：
 *
 *   选中的文件
 *     → 判断类型（书/视频/音频/图片）
 *     → 算 SHA-256
 *     → 查库里有没有同哈希的载体（有就**不重复入库**，直接告知"已在库中"）
 *     → 复制进对象仓 objects/ab/cd/<hash>.<ext>
 *     → 建载体记录（status: pending）
 *     → 入摄取队列（跑解析/索引）
 *
 * 关于"重复"的语义：
 * 用户从不同文件夹拖进同一本书（比如一本 PDF 存了两份），
 * 内容哈希一样，就只入库一次，第二条提示"已在库中"。
 * 这不是错误，是内容寻址去重的正常结果——所以 ImportOutcome 里
 * ok=true 且带 duplicateOf，UI 上显示成"跳过（已存在）"而不是红色报错。
 */

import type { Database } from 'node-sqlite3-wasm'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { Carrier, CarrierType } from '@shared/types/carrier'
import type { ImportOutcome } from '@shared/contracts/ingest'
import { storeFile, registerObjectRow, guessMime } from '../storage/objects'
import { SqliteStorage } from '../storage/repository'
import { carrierFromRow, type Row } from '../storage/rowmap'
import { IngestRunner } from './runner'

/** 扩展名 → 载体类型 */
const EXT_TYPE: Record<string, CarrierType> = {
  '.pdf': 'book',
  '.epub': 'book',
  '.txt': 'book',
  '.md': 'book',
  '.mp4': 'video',
  '.mkv': 'video',
  '.mov': 'video',
  '.webm': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.flac': 'audio',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.bmp': 'image'
}

/** 由文件名推一个像样的标题（去扩展名、下划线转空格） */
function titleFromFile(filePath: string): string {
  const name = basename(filePath)
  const ext = extname(name)
  return name.slice(0, name.length - ext.length).replace(/_+/g, ' ').trim() || name
}

/** 格式标识（存进 carriers.format） */
function formatOf(filePath: string): string {
  return extname(filePath).replace(/^\./, '').toLowerCase()
}

export class FileImporter {
  private readonly storage: SqliteStorage
  private readonly runner: IngestRunner

  constructor(
    private readonly db: Database,
    runner: IngestRunner
  ) {
    this.storage = new SqliteStorage(db)
    // 队列状态必须全局唯一，所以 runner 由外部注入而非各自 new
    this.runner = runner
  }

  /** 导入一批文件 */
  async importFiles(paths: string[]): Promise<ImportOutcome[]> {
    const results: ImportOutcome[] = []
    for (const p of paths) {
      try {
        results.push(await this.importOne(p))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[ingest] 导入失败 ${p}：`, msg)
        results.push({ ok: false, error: msg })
      }
    }
    return results
  }

  /** 导入单个文件 */
  private async importOne(filePath: string): Promise<ImportOutcome> {
    const ext = extname(filePath).toLowerCase()
    const type = EXT_TYPE[ext]
    if (!type) {
      return { ok: false, error: `不支持的文件类型：${ext || '（无扩展名）'}` }
    }

    const info = await stat(filePath)
    if (!info.isFile()) return { ok: false, error: '不是文件' }
    // 空文件挡在门外：0 字节的 PDF 解析必然出错，早报早省事
    if (info.size === 0) return { ok: false, error: '文件是空的（0 字节）' }

    // 1. 收进对象仓（内部会算哈希；同哈希不重复拷贝）
    const obj = await storeFile(filePath)
    // 登记到 objects 表（存储统计靠它算真实磁盘占用）
    registerObjectRow(this.db, obj, guessMime(obj.ext))

    // 2. 查重：同内容哈希的载体是否已存在
    const existing = this.findByContentHash(obj.hash)
    if (existing) {
      return {
        ok: true,
        carrierId: existing.id,
        title: existing.title,
        duplicateOf: existing.id
      }
    }

    // 3. 建载体记录
    const id = `c-file-${obj.hash.slice(0, 12)}`
    const title = titleFromFile(filePath)
    const carrier: Carrier = {
      id,
      title,
      type,
      format: formatOf(filePath),
      description: `从本地文件导入（${basename(filePath)}）`,
      sizeBytes: obj.size,
      tags: [],
      contentHash: obj.hash,
      objectHash: obj.hash,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    await this.storage.addCarrier(carrier)

    // 4. 入队
    const task = this.runner.enqueue(id, title, type)

    return { ok: true, carrierId: id, title, taskId: task.id }
  }

  /** 按内容哈希找已有载体（返回完整领域对象，别用半截对象糊弄类型） */
  private findByContentHash(hash: string): Carrier | null {
    const row = this.db.get(`SELECT * FROM carriers WHERE content_hash = ? LIMIT 1`, [hash]) as
      | Row
      | null
    return row ? carrierFromRow(row) : null
  }

  /**
   * 网页导入后建载体（供 WebImporter 复用，保持 id 规则一致）。
   *
   * @param input.text 已解析出的正文（这里只用来算哈希，正文由调用方先写 documents）
   */
  async addWebCarrier(input: {
    title: string
    url: string
    text: string
    coverHash?: string
    imageHashes: string[]
    sizeBytes: number
    contentHash: string
  }): Promise<{ carrierId: string; taskId: string; duplicate: boolean }> {
    const existing = this.findByContentHash(input.contentHash)
    if (existing) {
      // 同一网页抓两次：不重复建载体，也不再排任务
      return { carrierId: existing.id, taskId: '', duplicate: true }
    }

    const id = `c-web-${input.contentHash.slice(0, 12)}`
    const carrier: Carrier = {
      id,
      title: input.title,
      type: 'webpage',
      format: 'html',
      description: `网页存档（${input.imageHashes.length} 张图片）`,
      sizeBytes: input.sizeBytes,
      coverUrl: input.coverHash ? `object://${input.coverHash}` : undefined,
      tags: [],
      contentHash: input.contentHash,
      objectHash: input.contentHash,
      sourceUrl: input.url,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    await this.storage.addCarrier(carrier)

    // 网页图片资产登记（第一张且被选为封面 → role=cover）
    const now = new Date().toISOString()
    input.imageHashes.forEach((hash, i) => {
      this.db.run(
        `INSERT INTO carrier_assets (id, carrier_id, hash, role, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [
          `asset-${id}-${i}`,
          id,
          hash,
          i === 0 && input.coverHash === hash ? 'cover' : 'inline',
          input.url,
          now
        ]
      )
    })

    const task = this.runner.enqueue(id, input.title, 'webpage')
    return { carrierId: id, taskId: task.id, duplicate: false }
  }
}
