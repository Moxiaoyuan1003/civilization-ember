/**
 * EPUB 正文抽取（主进程，第 10 期）。
 *
 * EPUB 本质上是一个 ZIP 包，里面的结构是：
 *
 *     META-INF/container.xml   → 指向 OPF（包描述文件）的位置
 *     OEBPS/content.opf        → 列出所有章节文件（manifest）与阅读顺序（spine）
 *     OEBPS/chapter1.xhtml     → 每章的 XHTML
 *
 * 所以抽取分三步走：找 OPF → 读 spine 顺序 → 逐个 XHTML 抽正文。
 *
 * 三个刻意的取舍：
 *
 * 1. **相信 spine 的阅读顺序，不走文件名排序**。
 *    EPUB 里文件名可能是 `chapter10.xhtml`、`part1.xhtml`、甚至一串 UUID，
 *    按名字排会得到乱序的书。spine 才是作者/工具声明的正确顺序。
 *
 * 2. **一章一页**，而不是按字数重新装箱。
 *    EPUB 的章节是作者划的，读者和目录都期望"一章是一块"。
 *    拆成 1200 字一页会让"第 3 章"横跨 4 个页号，跳转反而更难。
 *    极长的章（几万字）再按段落切成若干页，避免单页滚动太久。
 *
 * 3. **抽不到正文时说清楚为什么**，不返回空文档。
 *    有些 EPUB 是纯图片漫画（只有 `<img>`），有些选了 DRM 加密读不出来。
 *    这两种都该明确告诉用户，而不是给一本白页书。
 */

import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import JSZip from 'jszip'
import * as cheerio from 'cheerio'
import type { BookDoc, DocPage, TocItem } from '@shared/types/book'

/** 一章最长允许的字数，超过就按段落切成多页（不硬切段落） */
const MAX_CHARS_PER_PAGE = 1800

/** 一个 spine 项 */
interface SpineItem {
  /** ZIP 内的文件路径（相对 OPF 定位解析后的绝对路径） */
  href: string
  /** 目录用的标题（来自 nav 或 toc，可能为空） */
  title?: string
}

/** EPUB 抽取结果 */
export interface EpubExtractResult {
  doc: BookDoc | null
  /** 抽不到正文的原因（成功时为 undefined） */
  reason?: string
  /** 章节文件数 */
  chapterFiles: number
  /** 没有文字内容的章节数（封面页、纯图片页很常见） */
  emptyChapters: number
}

/**
 * 抽取整本 EPUB 的文字。
 *
 * @param onProgress 每处理完一章回调一次（0~1）
 */
export async function extractEpub(
  carrierId: string,
  filePath: string,
  title: string,
  onProgress?: (ratio: number) => void
): Promise<EpubExtractResult> {
  const buf = await readFile(filePath)
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buf)
  } catch {
    throw new Error('这个 EPUB 打不开（文件可能损坏，或者根本不是 ZIP 格式的 EPUB）')
  }

  // 1. 找 OPF：先读 container.xml，读不到就全盘扫一遍找 .opf
  const opfPath = await findOpfPath(zip)
  if (!opfPath) {
    throw new Error('这个 EPUB 里找不到包描述文件（.opf），结构不符合规范')
  }

  const opfText = await readZipText(zip, opfPath)
  if (!opfText) throw new Error('EPUB 的包描述文件读不出来')

  const $opf = cheerio.load(opfText, { xmlMode: true })

  // 2. 读 manifest：id → 文件路径（相对 OPF 目录）
  const opfDir = posix.dirname(opfPath)
  const manifest = new Map<string, string>()
  $opf('manifest > item').each((_i, el) => {
    const id = $opf(el).attr('id')
    const href = $opf(el).attr('href')
    if (id && href) manifest.set(id, resolveHref(opfDir, href))
  })

  // 3. 读 spine：按 idref 的顺序取出章节文件
  const spine: SpineItem[] = []
  $opf('spine > itemref').each((_i, el) => {
    const idref = $opf(el).attr('idref')
    if (!idref) return
    const href = manifest.get(idref)
    if (href) spine.push({ href })
  })

  if (spine.length === 0) {
    throw new Error('这个 EPUB 的阅读顺序（spine）是空的，没有可读的章节')
  }

  // 4. 尝试从 nav / toc 里取章节标题（取不到就用页内标题或"第 N 章"）
  const navTitles = await readNavTitles(zip, $opf, opfDir, manifest)
  const info = readBookInfo($opf, title)

  // 5. 逐章抽正文
  const pages: DocPage[] = []
  let emptyChapters = 0

  for (let i = 0; i < spine.length; i++) {
    const item = spine[i]
    const html = await readZipText(zip, item.href)
    if (!html) {
      emptyChapters += 1
      onProgress?.((i + 1) / spine.length)
      continue
    }

    const { paragraphs, heading } = htmlToParagraphs(html)
    const chapterTitle =
      navTitles.get(item.href) || heading || normalizeTitle(item.href) || `第 ${i + 1} 章`

    if (paragraphs.length === 0) {
      // 空章节（封面页、纯图片页很常见）→ 不占页，但记一笔
      emptyChapters += 1
      onProgress?.((i + 1) / spine.length)
      continue
    }

    // 长章节按段落切页（不硬切段落）
    for (const chunk of packParagraphs(paragraphs)) {
      pages.push({ pageNo: pages.length + 1, chapter: chapterTitle, paragraphs: chunk })
    }

    onProgress?.((i + 1) / spine.length)
  }

  if (pages.length === 0) {
    return {
      doc: null,
      reason: '这本书里没有可读的文字（可能是纯图片画册，或者内容被加密了）',
      chapterFiles: spine.length,
      emptyChapters
    }
  }

  const toc = buildToc(pages)
  return {
    doc: { carrierId, title: info.title || title, subtitle: info.author, pages, toc },
    chapterFiles: spine.length,
    emptyChapters
  }
}

/** 找 OPF 路径：优先 container.xml，其次全盘扫 .opf */
async function findOpfPath(zip: JSZip): Promise<string | null> {
  const containerText = await readZipText(zip, 'META-INF/container.xml')
  if (containerText) {
    const $c = cheerio.load(containerText, { xmlMode: true })
    // 规范里 rootfile 的 full-path 是相对 ZIP 根的
    const fullPath = $c('rootfile').first().attr('full-path')
    if (fullPath && zip.file(fullPath)) return fullPath
  }
  // 退化路径：有些自制 EPUB 的 container.xml 写得不对，直接找 .opf
  const opfFiles = Object.keys(zip.files).filter(
    (n) => n.toLowerCase().endsWith('.opf') && !zip.files[n].dir
  )
  return opfFiles[0] ?? null
}

/** 读 ZIP 内某个文件的 UTF-8 文本（不存在返回 null） */
async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path)
  if (!file) return null
  try {
    return await file.async('string')
  } catch {
    return null
  }
}

/** 相对 OPF 目录解析 href（处理 `../` 与已编码的 URL） */
function resolveHref(baseDir: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0])
  if (clean.startsWith('/')) return clean.slice(1)
  return posix.normalize(posix.join(baseDir, clean))
}

/** 读 nav / NCX 里的章节标题 */
async function readNavTitles(
  zip: JSZip,
  $opf: cheerio.CheerioAPI,
  opfDir: string,
  manifest: Map<string, string>
): Promise<Map<string, string>> {
  const titles = new Map<string, string>()

  // 优先用 EPUB3 的 nav 文档（properties="nav"）
  let navHref: string | undefined
  $opf('manifest > item').each((_i, el) => {
    const props = $opf(el).attr('properties') ?? ''
    if (props.split(/\s+/).includes('nav')) {
      const id = $opf(el).attr('id')
      if (id) navHref = manifest.get(id)
    }
  })

  if (navHref) {
    const navText = await readZipText(zip, navHref)
    if (navText) {
      const $n = cheerio.load(navText, { xmlMode: true })
      $n('nav a, nav link').each((_i, el) => {
        const href = $n(el).attr('href')
        const label = $n(el).text().trim()
        if (href && label) {
          const key = resolveHref(posix.dirname(navHref as string), href)
          if (!titles.has(key)) titles.set(key, label)
        }
      })
    }
  }

  // 退回 EPUB2 的 NCX（toc.ncx）
  if (titles.size === 0) {
    let ncxHref: string | undefined
    $opf('manifest > item').each((_i, el) => {
      const type = $opf(el).attr('media-type') ?? ''
      if (type.includes('dtbncx') || type.includes('ncx')) {
        const id = $opf(el).attr('id')
        if (id) ncxHref = manifest.get(id)
      }
    })
    if (!ncxHref) {
      const found = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.ncx'))
      ncxHref = found
    }
    if (ncxHref) {
      const ncxText = await readZipText(zip, ncxHref)
      if (ncxText) {
        const $x = cheerio.load(ncxText, { xmlMode: true })
        $x('navPoint').each((_i, el) => {
          const label = $x(el).children('navLabel').first().text().trim()
          const src = $x(el).children('content').first().attr('src')
          if (label && src) {
            const key = resolveHref(posix.dirname(ncxHref as string), src)
            if (!titles.has(key)) titles.set(key, label)
          }
        })
      }
    }
  }

  return titles
}

/** 读书名与作者（OPF 的 metadata） */
function readBookInfo($opf: cheerio.CheerioAPI, fallbackTitle: string): {
  title: string
  author?: string
} {
  const title = $opf('metadata > dc\\:title, title').first().text().trim() || fallbackTitle
  const author =
    $opf('metadata > dc\\:creator, creator').first().text().trim() || undefined
  return { title, author }
}

/**
 * XHTML → 段落数组 + 页内标题。
 *
 * 和网页抽取的区别：EPUB 的每章是一个整体，不用找"正文容器"，
 * 直接把 body 里的块级元素按顺序取出来即可。
 */
function htmlToParagraphs(html: string): { paragraphs: string[]; heading?: string } {
  const $ = cheerio.load(html)

  // 先删掉不该进正文的东西
  $('script, style, svg, nav, head, title').remove()

  const paragraphs: string[] = []
  let heading: string | undefined

  // 直接在整个文档里找块级元素：EPUB 的每章就是一个完整 XHTML，
  // 不需要像抓网页那样猜"哪个 div 是正文"。
  // （不用先取 body 再 find：cheerio 的类型里 body 可能是 Document 或 Element，
  //   `$()` 直接选则没有这个歧义）
  $('h1, h2, h3, h4, p, li, blockquote, pre, td').each((_i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (!text) return
    const tag = ((el as { tagName?: string }).tagName ?? '').toLowerCase()

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      // 第一个标题当章节名；其余标题作为独立段落保留（读者需要看到小节名）
      if (!heading) {
        heading = text
        // 短标题直接当章节名，不再重复进正文
        if (text.length <= 40) return
      }
      paragraphs.push(text)
      return
    }
    paragraphs.push(text)
  })

  // 一个块级元素都没抓到（正文全在 div/span 里）→ 退回整段文本
  if (paragraphs.length === 0) {
    const whole = $.root().text().replace(/\s+/g, ' ').trim()
    if (whole) paragraphs.push(whole)
  }

  return { paragraphs, heading }
}

/** 把段落装箱成页（每页不超过 MAX_CHARS_PER_PAGE，不切断段落） */
function packParagraphs(paragraphs: string[]): string[][] {
  const pages: string[][] = []
  let buffer: string[] = []
  let len = 0

  for (const p of paragraphs) {
    if (len + p.length > MAX_CHARS_PER_PAGE && buffer.length > 0) {
      pages.push(buffer)
      buffer = []
      len = 0
    }
    buffer.push(p)
    len += p.length
  }
  if (buffer.length > 0) pages.push(buffer)
  return pages.length > 0 ? pages : [['（这一章没有文字）']]
}

/** 由文件名推一个像样的章节名（`chapter03` → `chapter03`，`ch_3` → `ch 3`） */
function normalizeTitle(href: string): string | null {
  const base = posix.basename(href)
  const name = decodeURIComponent(base).replace(/\.[^.]+$/, '')
  if (!name) return null
  // 纯数字/UUID 文件名不配当章节名，交给"第 N 章"
  if (/^[0-9a-f-]{8,}$/i.test(name) || /^\d+$/.test(name)) return null
  return name.replace(/[_-]+/g, ' ')
}

/** 由页生成目录：连续同章节的页合并成一条 */
function buildToc(pages: DocPage[]): TocItem[] {
  const toc: TocItem[] = []
  for (const page of pages) {
    const last = toc[toc.length - 1]
    if (last && last.title === page.chapter) {
      last.pageCount += 1
    } else {
      toc.push({ title: page.chapter, pageNo: page.pageNo, pageCount: 1 })
    }
  }
  return toc
}
