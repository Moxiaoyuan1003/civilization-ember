/**
 * 纯文本 → 分页正文（第 9 期的解析器）。
 *
 * 阅读器需要的是 `BookDoc{pages,toc}`——"页"和"目录"两样东西。
 * PDF/EPUB 天然有页（第 10 期接），而 TXT/Markdown 没有页的概念，
 * 所以这里按字数切：每页大约 1200 字，尽量在段落边界断开。
 *
 * 三个刻意的取舍：
 * 1. **不切断段落**：宁可某页少于 1200 字，也不把一段话劈成两半。
 *    读半句话到下一页是纸质书才有的体验，屏幕阅读器不该这样。
 * 2. **章节按标题识别**：Markdown 的 `#`/`##`、以及"第X章"这类行都算。
 * 3. **页号从 1 开始**：和阅读器 `P1` `.location` 的既有约定一致。
 */

import type { BookDoc, DocPage, TocItem } from '@shared/types/book'

/** 一页大约多少字 */
const CHARS_PER_PAGE = 1200

/** 判断一行是不是章节标题（PDF/EPUB 解析器也要用，所以导出） */
export function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  // Markdown 标题
  if (/^#{1,3}\s+\S/.test(t)) return true
  // 中文章节：第一章 / 第 3 节 / 序 / 前言 / 后记 / 附录
  if (/^第\s*[一二三四五六七八九十百零〇0-9]+\s*[章节篇部]/.test(t)) return true
  if (/^(序|序言|前言|引言|后记|附录|尾声|导言)(\s|$)/.test(t)) return true
  // 英文 Chapter N
  if (/^chapter\s+\d+/i.test(t)) return true
  return false
}

/** 去掉 Markdown 的井号前缀，留干净标题（导出给 PDF/EPUB 解析器复用） */
export function cleanHeading(line: string): string {
  return line.trim().replace(/^#{1,3}\s+/, '')
}

/**
 * 把一段纯文本切成 BookDoc。
 *
 * @param carrierId 归属载体
 * @param text 原始全文
 * @param title 书名（用于文档标题）
 */
export function paginateText(carrierId: string, text: string, title: string): BookDoc {
  // 统一换行、去掉行尾空白；连续空行压成一个空行（分段依据）
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '')

  // 按行分组：每个"块"是若干行（一个段落），标题单独成块并记下章节
  const blocks: { text: string; chapter: string }[] = []
  let currentChapter = '正文'

  const rawBlocks = normalized.split(/\n{2,}/)
  for (const raw of rawBlocks) {
    const chunk = raw.trim()
    if (!chunk) continue

    // 块内第一行若是标题，更新当前章节，并把标题作为章节名（不进正文）
    const lines = chunk.split('\n')
    const first = lines[0] ?? ''
    if (isHeading(first)) {
      currentChapter = cleanHeading(first)
      const rest = lines.slice(1).join('\n').trim()
      if (rest) blocks.push({ text: rest, chapter: currentChapter })
      continue
    }
    blocks.push({ text: chunk, chapter: currentChapter })
  }

  // 没有识别出任何章节时，整篇算一章"正文"
  if (blocks.length === 0) {
    blocks.push({ text: normalized.trim() || '（这份文件没有可读的文字内容）', chapter: '正文' })
  }

  /* ---- 按字数装箱成页 ---- */
  const pages: DocPage[] = []
  let buffer: string[] = []
  let bufferLen = 0
  let pageChapter = blocks[0].chapter

  const flush = (): void => {
    if (buffer.length === 0) return
    pages.push({
      pageNo: pages.length + 1,
      chapter: pageChapter,
      paragraphs: buffer
    })
    buffer = []
    bufferLen = 0
  }

  for (const block of blocks) {
    // 换章时先结束当前页，让新章从新页开始（阅读体验上更清楚）
    if (block.chapter !== pageChapter && buffer.length > 0) {
      flush()
    }
    pageChapter = block.chapter

    const len = block.text.length
    // 单块就超一页：先冲掉已有内容，再把它单独成页（不硬切段落）
    if (len > CHARS_PER_PAGE && buffer.length === 0) {
      pages.push({
        pageNo: pages.length + 1,
        chapter: block.chapter,
        paragraphs: [block.text]
      })
      continue
    }
    // 放不下就换页
    if (bufferLen + len > CHARS_PER_PAGE && buffer.length > 0) {
      flush()
      pageChapter = block.chapter
    }
    buffer.push(block.text)
    bufferLen += len
  }
  flush()

  /* ---- 由页生成目录：连续同章节的页合并成一条 ---- */
  const toc: TocItem[] = []
  for (const page of pages) {
    const last = toc[toc.length - 1]
    if (last && last.title === page.chapter) {
      last.pageCount += 1
    } else {
      toc.push({ title: page.chapter, pageNo: page.pageNo, pageCount: 1 })
    }
  }

  return { carrierId, title, pages, toc }
}

/**
 * HTML → 纯文本（网页用）。
 *
 * 处理顺序很重要：先删掉 script/style/nav/footer 这些"不是正文"的标签，
 * 再从剩下的结构里按块级元素取文字。直接 text() 会把导航栏、页脚、
 * cookie 提示全混进来——那是抓网页最常见的脏数据来源。
 */
export function htmlToPlainText(html: string): { title: string; text: string } {
  // 动态 import 让 cheerio 只在真抓网页时才加载（冷启动更快）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cheerio = require('cheerio') as typeof import('cheerio')
  const $ = cheerio.load(html)

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    '未命名网页'

  // 剔除非正文结构
  $('script, style, noscript, iframe, nav, footer, header, aside, form, svg').remove()
  // 常见广告/分享/评论容器（按 class/id 关键词剔除，宁可多删）
  $('[class*="advert"], [id*="advert"], [class*="share"], [class*="comment"], [class*="sidebar"], [class*="cookie"]').remove()

  // 优先取语义正文容器，找不到就退回 body
  const root =
    $('article').length > 0
      ? $('article').first()
      : $('main').length > 0
        ? $('main').first()
        : $('[role="main"]').length > 0
          ? $('[role="main"]').first()
          : $('body')

  // 按块级元素收集段落，块之间用空行分隔（与 paginateText 的分段约定一致）
  const parts: string[] = []
  root.find('h1, h2, h3, h4, p, li, blockquote, pre, td').each((_i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (!text) return
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? ''
    // 标题行原样保留（paginateText 会识别成章节）
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      parts.push(`## ${text}`)
    } else {
      parts.push(text)
    }
  })

  // 一段块级元素都没抓到（有些页面全是 div）→ 退回整段文本
  const text = parts.length > 0 ? parts.join('\n\n') : root.text().replace(/\n{3,}/g, '\n\n').trim()

  return { title, text }
}
