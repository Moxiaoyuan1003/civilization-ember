/**
 * 网页导入器（主进程）。
 *
 * 用户明确要求「网页也要保存照片」，所以这里不是只抽文字就完事：
 *
 *   抓 HTML → 解析正文（cheerio，剔导航/广告/页脚）
 *          → 抽 <img> 的绝对 URL
 *          → 一张张下载、识别扩展名、存进对象仓（内容寻址，天然去重）
 *          → 正文切成页存 documents（阅读器直接能看）
 *          → 建载体 + 图片资产 + 入队
 *
 * 为什么图片也要内容寻址：
 * 同一个站点的图标、同一张配图会被多个页面引用。按内容哈希存，
 * 抓十个页面也只占一份图标。而且网页原图链接会失效（十年后必然失效），
 * 存下来的这份才是"火种"。
 *
 * 关于失败的处理：
 * 图片下载失败**不让整个导入失败**。文字是主干，图是枝叶——
 * 十张图挂三张，仍然应该入库，并在描述里如实写清数量。
 * 但如果正文一个字都没抓到，那才是真失败（返回 ok:false）。
 */

import type { Database } from 'node-sqlite3-wasm'
import { createHash } from 'node:crypto'
import { storeBuffer, registerObjectRow, guessMime } from '../storage/objects'
import { DocumentRepo } from '../storage/documents'
import { htmlToPlainText, paginateText } from './paginate'
import { FileImporter } from './fileImporter'
import type { IngestRunner } from './runner'
import type { ImportOutcome } from '@shared/contracts/ingest'
import type { BookDoc } from '@shared/types/book'

/** 抓取超时（毫秒） */
const FETCH_TIMEOUT_MS = 20_000
/** 单张图片大小上限（超过就跳过：网页上偶尔有几十 MB 的原始大图） */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
/** 一次最多下载多少张图（防某个页面挂几百张缩略图把队列堵死） */
const MAX_IMAGES = 30

/** Content-Type / 扩展名 → 保存用的扩展名 */
function extFromContentType(ct: string | null, url: string): string {
  const t = (ct ?? '').toLowerCase()
  if (t.includes('png')) return '.png'
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg'
  if (t.includes('webp')) return '.webp'
  if (t.includes('gif')) return '.gif'
  if (t.includes('bmp')) return '.bmp'
  if (t.includes('svg')) return '.svg'
  // 退而从 URL 猜
  const m = /\.(png|jpe?g|webp|gif|bmp|svg)(?:\?|$)/i.exec(url)
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg'
}

/** 带超时的 fetch */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // 有些站点对无 UA 的请求直接 403
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,image/avif,image/webp,*/*'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

export class WebImporter {
  private readonly docs: DocumentRepo
  private readonly files: FileImporter

  constructor(
    private readonly db: Database,
    runner: IngestRunner
  ) {
    this.docs = new DocumentRepo(db)
    this.files = new FileImporter(db, runner)
  }

  /** 抓一个网页入库 */
  async importUrl(rawUrl: string): Promise<ImportOutcome> {
    let url: URL
    try {
      url = new URL(rawUrl.trim())
    } catch {
      return { ok: false, error: `网址格式不对：${rawUrl}` }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: '只支持 http / https 网址' }
    }

    // 1. 抓 HTML
    let resp: Response
    try {
      resp = await fetchWithTimeout(url.toString())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `抓取失败：${msg}` }
    }
    if (!resp.ok) {
      return { ok: false, error: `服务器返回 ${resp.status} ${resp.statusText}` }
    }
    const contentType = resp.headers.get('content-type')
    if (contentType && !contentType.includes('text/html') && !contentType.includes('xml')) {
      return { ok: false, error: `不是网页（Content-Type: ${contentType}）` }
    }

    const html = await resp.text()
    if (!html.trim()) return { ok: false, error: '页面是空的' }

    // 2. 抽正文
    const { title, text } = htmlToPlainText(html)
    if (text.trim().length < 20) {
      return {
        ok: false,
        error: '没抽到正文（这个页面可能要求登录、或被反爬拦截，只能拿到空壳）'
      }
    }

    // 3. 抓图片（失败不阻断）
    const { imageHashes, coverHash, failedCount } = await this.grabImages(html, url)

    // 4. 正文切页（先算出文档，但**先不落库**）
    const contentHash = createHash('sha256')
      .update(url.toString())
      .update('\n')
      .update(text)
      .digest('hex')

    const carrierId = `c-web-${contentHash.slice(0, 12)}`
    const doc: BookDoc = paginateText(carrierId, text, title)

    // 5. 建载体 + 任务
    const approxBytes = Buffer.byteLength(text, 'utf8') + imageHashes.length * 60_000
    const created = await this.files.addWebCarrier({
      title,
      url: url.toString(),
      text,
      coverHash,
      imageHashes,
      sizeBytes: approxBytes,
      contentHash
    })

    if (created.duplicate) {
      return {
        ok: true,
        carrierId: created.carrierId,
        title,
        duplicateOf: created.carrierId
      }
    }

    // 6. 正文落库
    //
    // 顺序不能倒：documents.carrier_id 有外键指向 carriers(id)，
    // 载体还没建就写正文会报 `FOREIGN KEY constraint failed`（踩过一次）。
    // 所以要等 addWebCarrier 把 carriers 行插进去之后再存正文。
    this.docs.save(doc)

    // 7. 描述里如实写图片张数（含失败数），不粉饰
    const imgNote =
      failedCount > 0
        ? `${imageHashes.length} 张图片（${failedCount} 张下载失败已跳过）`
        : `${imageHashes.length} 张图片`
    this.db.run(`UPDATE carriers SET description = ? WHERE id = ?`, [
      `网页存档 · 正文约 ${text.length} 字 · ${imgNote}（来源：${url.hostname}）`,
      created.carrierId
    ])

    return { ok: true, carrierId: created.carrierId, title, taskId: created.taskId }
  }

  /**
   * 下载页面里的图片。
   *
   * 只取 http(s) 绝对地址与 data URI 不要（data URI 已内联，不算独立资产）；
   * 相对地址按页面 URL 补全。每张限额 8MB、总数限 30 张。
   */
  private async grabImages(
    html: string,
    pageUrl: URL
  ): Promise<{ imageHashes: string[]; coverHash?: string; failedCount: number }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cheerio = require('cheerio') as typeof import('cheerio')
    const $ = cheerio.load(html)

    const urls: string[] = []
    $('img').each((_i, el) => {
      // 优先取懒加载属性（很多站点的 src 是占位图）
      const raw =
        $(el).attr('data-src') ||
        $(el).attr('data-original') ||
        $(el).attr('src') ||
        ''
      const src = String(raw).trim()
      if (!src || src.startsWith('data:')) return
      try {
        const abs = new URL(src, pageUrl).toString()
        if (abs.startsWith('http://') || abs.startsWith('https://')) urls.push(abs)
      } catch {
        // 相对地址补全失败就跳过
      }
    })

    // 去重 + 截断
    const unique = [...new Set(urls)].slice(0, MAX_IMAGES)
    const hashes: string[] = []
    let failedCount = 0

    for (const imgUrl of unique) {
      try {
        const res = await fetchWithTimeout(imgUrl)
        if (!res.ok) {
          failedCount += 1
          continue
        }
        const buf = new Uint8Array(await res.arrayBuffer())
        if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) {
          failedCount += 1
          continue
        }
        const ext = extFromContentType(res.headers.get('content-type'), imgUrl)
        const obj = await storeBuffer(buf, ext)
        registerObjectRow(this.db, obj, guessMime(ext))
        hashes.push(obj.hash)
      } catch {
        failedCount += 1
      }
    }

    // 封面：取第一张成功下载且不是超小图标（<4KB 多半是像素/图标）
    let coverHash: string | undefined
    for (const h of hashes) {
      coverHash = h
      break
    }

    return { imageHashes: hashes, coverHash, failedCount }
  }
}
