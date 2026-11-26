/**
 * PDF 正文抽取（主进程，第 10 期）。
 *
 * 只做一件事：把 PDF 每一页的文字抽出来，变成阅读器能读的 `BookDoc`。
 * **不渲染页面**（不画成图片）——渲染是第 11 期阅读器的事，
 * 这里只负责"文字能不能读"。
 *
 * 为什么用 pdfjs-dist 而不是自己解 PDF：
 * PDF 的文字可能被压缩流、子集化字体、自定义编码层层包着，
 * 中文字体还常见"没有 ToUnicode 表"的情况——自己写等于重造一个 pdf.js。
 *
 * 三个刻意的取舍：
 *
 * 1. **一页 PDF 就是一页书**，不重新排版。
 *    PDF 的页是作者定的，抽出来的文字按原页装；重排会把"图旁边的说明"
 *    和"正文"混在一起，读者反而找不到位置。这和 TXT 那种"按字数装箱"不同。
 *
 * 2. **扫描版如实报"需要 OCR"，不假装成功**。
 *    扫描版 PDF 里没有文字层，抽出来是空的。这时候如果返回一份空文档，
 *    用户点开是白页，会以为软件坏了；明确说"这需要文字识别"才是诚实的。
 *
 * 3. **章节按页内标题行识别**，识别不到就用"正文"。
 *    宁可目录粗糙，也不要编造出不存在的章节。
 */

import { dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { BookDoc, DocPage, TocItem } from '@shared/types/book'
import { cleanHeading, isHeading } from './paginate'

/**
 * 动态 import 的包装。
 *
 * 为什么绕这一下：主进程打包产物是 CommonJS，而 pdf.js 只提供 ESM。
 * 直接写 `await import('...')` 会被 esbuild 改写成
 * `Promise.resolve().then(() => require('...'))`，运行时抛
 * `ERR_REQUIRE_ESM`。用 `new Function` 把 import 藏起来，
 * esbuild 就看不见它，运行时仍是原生 import()。
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>

/**
 * pdf.js 的 cmaps / 标准字体目录。
 *
 * 缺了它们，某些 PDF 的中文会被抽成乱码或干脆抽不出来——
 * 因为 pdf.js 需要这些数据表来还原自定义编码的中文字体。
 * 路径必须是正斜杠结尾，pdf.js 内部会校验"必须以斜杠结尾"。
 */
function pdfResources(): { cMapUrl: string; standardFontDataUrl: string } {
  // pdfjs-dist 没有 exports 字段，所以能直接 resolve 到 package.json
  const pkg = require.resolve('pdfjs-dist/package.json') as string
  const base = dirname(pkg).replace(/\\/g, '/')
  return {
    cMapUrl: `${base}/cmaps/`,
    standardFontDataUrl: `${base}/standard_fonts/`
  }
}

/** 一页抽出来的文字（按行切好） */
interface PageText {
  lines: string[]
  /** 这一页的字符数（0 = 扫描页，没有文字层） */
  chars: number
}

/** 少于这个字数就当"没有文字层"（有些扫描件每页只有一个页码或水印） */
const MIN_CHARS_PER_PAGE = 12

/** 若这行是标题就返回干净标题，否则 null */
function headingOf(line: string): string | null {
  if (!isHeading(line)) return null
  return cleanHeading(line)
}

/**
 * 把行按段落聚起来。
 *
 * PDF 的"行"很碎：一句话可能被拆成好几行，页眉页脚也混在里面。
 * 规则是：**空行必分段；行尾是句末标点也分段**。
 * 这条规则在真实书上偶尔会把一段拆成两段，但不会把两段粘成一段——
 * 后者对阅读的伤害更大。
 */
function groupParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = []
  let buffer: string[] = []

  const flush = (): void => {
    const text = buffer.join('').trim()
    if (text) paragraphs.push(text)
    buffer = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    buffer.push(line)
    if (/[。！？；：…”』」]$/.test(line) || /[.!?;:]$/.test(line)) {
      flush()
    }
  }
  flush()
  return paragraphs
}

/** 抽取结果 */
export interface PdfExtractResult {
  /** 抽出来的文档；整本都是扫描页时为 null */
  doc: BookDoc | null
  /** 没有文字层的页数 */
  scannedPages: number
  /** 总页数 */
  totalPages: number
}

/**
 * 抽取整本 PDF 的文字。
 *
 * @param onProgress 每处理完一页回调一次（0~1），供界面进度条使用
 */
export async function extractPdf(
  carrierId: string,
  filePath: string,
  title: string,
  onProgress?: (ratio: number) => void
): Promise<PdfExtractResult> {
  // 动态 import：pdf.js 是 ESM 且体积近 1MB，冷启动时不必加载
  const pdfjs = (await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs')) as {
    getDocument: (opts: Record<string, unknown>) => {
      promise: Promise<PdfDocument>
      destroy: () => Promise<void>
    }
  }

  const data = new Uint8Array(await readFile(filePath))
  const { cMapUrl, standardFontDataUrl } = pdfResources()

  // 不传 worker：主进程里 pdf.js 会以同线程方式解析，
  // 对我们这种一次性抽文字足够，也省掉一个 worker 的启动与打包问题。
  const task = pdfjs.getDocument({
    data,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    useSystemFonts: false,
    // 我们只要文字，不要字形渲染能力
    isEvalSupported: false,
    disableFontFace: true
  })

  const pdf = await task.promise
  try {
    const total = pdf.numPages
    const pages: DocPage[] = []
    let scannedPages = 0
    let chapter = '正文'

    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = textOfPage(content.items)

      if (pageText.chars < MIN_CHARS_PER_PAGE) {
        // 扫描页：留一条说明，而不是塞一张空白页
        scannedPages += 1
        pages.push({
          pageNo: i,
          chapter,
          paragraphs: ['（这一页是图片，没有文字层——需要文字识别才能读，第 15 期接入）']
        })
      } else {
        // 页内第一个标题行切换章节
        for (const line of pageText.lines) {
          const h = headingOf(line)
          if (h) {
            chapter = h
            break
          }
        }
        let paragraphs = groupParagraphs(pageText.lines.filter((l) => headingOf(l) === null))
        if (paragraphs.length === 0) {
          // 有字但全被当标题吃掉了：把原文整段放回去，别丢内容
          paragraphs = [pageText.lines.join(' ').trim()]
        }
        pages.push({ pageNo: i, chapter, paragraphs })
      }

      onProgress?.(i / total)
    }

    // 整本几乎没有可读文字 → 不生成文档，交给上层报"需要 OCR"
    if (total - scannedPages === 0) {
      return { doc: null, scannedPages, totalPages: total }
    }

    return {
      doc: { carrierId, title, pages, toc: buildToc(pages) },
      scannedPages,
      totalPages: total
    }
  } finally {
    // 必须 destroy：pdf.js 会保留解析出的字体与页面对象，不释放就泄漏
    await task.destroy()
  }
}

/** pdf.js 的 TextContent.items → 按行切好的文字 */
function textOfPage(items: ReadonlyArray<{ str?: string; hasEOL?: boolean }>): PageText {
  const lines: string[] = []
  let current = ''
  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : ''
    current += str
    if (item.hasEOL) {
      lines.push(current)
      current = ''
    }
  }
  if (current) lines.push(current)

  const cleaned = lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)

  // 有些 PDF 的 hasEOL 不可靠（整页挤成一行）→ 按句末标点兜底再切一次
  if (cleaned.length <= 1 && cleaned[0] && cleaned[0].length > 200) {
    const split = cleaned[0]
      .split(/(?<=[。！？])/)
      .map((s) => s.trim())
      .filter(Boolean)
    return { lines: split, chars: cleaned[0].length }
  }

  return { lines: cleaned, chars: cleaned.reduce((n, l) => n + l.length, 0) }
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

/** 最小化的 pdf.js 文档接口（只声明用到的部分，不引入它全部类型） */
interface PdfDocument {
  numPages: number
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: ReadonlyArray<{ str?: string; hasEOL?: boolean }> }>
  }>
}
