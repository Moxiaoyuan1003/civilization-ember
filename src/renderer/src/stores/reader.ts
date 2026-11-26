/**
 * 阅读器状态（Reader Store）。
 *
 * 负责：取书文档、当前页、目录、阅读模式、字号、书签、标注、阅读进度保存。
 * 所有"个人数据"（进度/书签/标注）都按 user_id + carrierId 隔离。
 *
 * 设计要点：
 * - 页码与滚动位置都换算成"页号"，进度统一按页号算百分比 —— 两种阅读模式共用一套进度。
 * - 进度保存做了防抖（读的时候不要每滚一下都写库）。
 */

import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useServices } from '@/services'
import type { BookDoc, Bookmark, ReadingMode } from '@shared/types/book'
import type { Annotation, User, UserPreferences } from '@shared/types/user'
import type { Carrier } from '@shared/types/carrier'

/** 字号档位（阅读器的"可读性"核心，用户强调阅读功能很重要） */
export const FONT_SIZES = [15, 16, 17, 18, 20, 22] as const

/** 本地存储键：阅读器的界面偏好（字号/模式）不属于服务端个人数据，先放本地 */
const UI_KEY = 'ember.reader.ui'

/** 阅读器界面偏好（字号 + 模式），本地持久化 */
interface ReaderUiPref {
  fontSize: number
  mode: ReadingMode
}

/** 读本地界面偏好 */
function loadUiPref(): ReaderUiPref {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ReaderUiPref>
      return {
        fontSize: typeof p.fontSize === 'number' ? p.fontSize : 17,
        mode: p.mode === 'scroll' ? 'scroll' : 'page'
      }
    }
  } catch {
    // 读不出来就用默认值，不打断阅读
  }
  return { fontSize: 17, mode: 'page' }
}

/**
 * 这个格式最可能是"整页图片"吗。
 *
 * 用来把"解析失败"说得更具体：PDF 读不出正文，十有八九是扫描件，
 * 而扫描件不是失败，是**还没接入文字识别**——这两句话对用户的意义完全不同，
 * 一句让人想去重试，一句让人知道该等什么。
 */
function scannedLike(format?: string): boolean {
  const f = (format ?? '').toLowerCase()
  return f === 'pdf' || f === 'epub' || f === 'png' || f === 'jpg' || f === 'jpeg'
}

export const useReaderStore = defineStore('reader', () => {
  const services = useServices()

  /* ---------- 数据 ---------- */
  const carrier = ref<Carrier | null>(null)
  const doc = ref<BookDoc | null>(null)
  const user = ref<User | null>(null)
  const prefs = ref<UserPreferences | null>(null)
  const bookmarks = ref<Bookmark[]>([])
  const annotations = ref<Annotation[]>([])

  /* ---------- 阅读状态 ---------- */
  const currentPage = ref(1)
  const fontSize = ref(loadUiPref().fontSize)
  const mode = ref<ReadingMode>(loadUiPref().mode)
  const tocOpen = ref(true)
  const panelOpen = ref(false)

  /* ---------- 流程状态 ---------- */
  const loading = ref(true)
  const error = ref<string | null>(null)
  /** 标注面板的临时输入（选中文字后弹出） */
  const selectionText = ref('')
  const annotationInput = ref('')

  /** 总页数 */
  const totalPages = computed(() => doc.value?.pages.length ?? 0)

  /** 当前页数据 */
  const page = computed<BookDoc['pages'][number] | null>(
    () => doc.value?.pages[currentPage.value - 1] ?? null
  )

  /** 当前章节标题 */
  const chapter = computed(() => page.value?.chapter ?? '')

  /** 阅读进度（按"已读页数 / 总页数"算，末页读满即为 1） */
  const percent = computed(() => {
    if (!totalPages.value) return 0
    return Math.min(1, currentPage.value / totalPages.value)
  })

  /** 是否能上一页/下一页 */
  const canPrev = computed(() => currentPage.value > 1)
  const canNext = computed(() => currentPage.value < totalPages.value)

  /** 当前页是否已有书签 */
  const currentBookmark = computed(
    () => bookmarks.value.find((b) => b.pageNo === currentPage.value) ?? null
  )

  /** 当前页的标注 */
  const pageAnnotations = computed(() =>
    annotations.value.filter((a) => a.location === `P${currentPage.value}`)
  )

  /** 加载某本书（阅读器入口调用） */
  async function load(carrierId: string): Promise<void> {
    loading.value = true
    error.value = null
    doc.value = null
    currentPage.value = 1
    bookmarks.value = []
    annotations.value = []

    try {
      const [c, d, u] = await Promise.all([
        services.storage.getCarrier(carrierId),
        services.document.getBookDoc(carrierId),
        services.storage.getOrCreateUser()
      ])
      carrier.value = c
      user.value = u

      if (!c) {
        error.value = '找不到这个载体'
        return
      }
      if (!d) {
        // 书存在但没解析出正文。这里要分清两种完全不同的情况，
        // 否则用户看到"需要先完成摄取"会去重试，而重试也救不了扫描件：
        //
        // ① 解析失败（carrier.status='failed'）= 机器尽力了但读不出来，
        //    最常见的是扫描版 PDF 没有文字层，要等第 15 期的文字识别。
        // ② 还没摄取完 = 排队中或刚导入，等一会儿就有。
        error.value =
          c.status === 'failed'
            ? scannedLike(c.format)
              ? '这本是图片型 PDF（整页没有文字层），需要文字识别才能读——第 15 期接入。原文件已安全存在库里，不会丢。'
              : '这本书解析失败了。原文件已安全存在库里，等解析器补齐后可以重试。'
            : '这本书还没有解析出可读正文（摄取可能还在排队，稍等或去管理页看进度）'
        return
      }

      doc.value = d
      prefs.value = await services.storage.getPreferences(u.id)

      // 并行取个人数据：书签 + 标注
      const [bm, anns, progress] = await Promise.all([
        services.storage.listBookmarks(u.id, carrierId),
        services.storage.listAnnotations(u.id, carrierId),
        services.storage.getReadingProgress(u.id, carrierId)
      ])
      bookmarks.value = bm
      annotations.value = anns

      // 恢复上次阅读位置：position 里存的是 "P<页码>"
      if (progress) {
        const m = /^P(\d+)$/.exec(progress.position)
        const p = m ? Number(m[1]) : 0
        if (p >= 1 && p <= d.pages.length) currentPage.value = p
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '阅读器加载失败'
    } finally {
      loading.value = false
    }
  }

  /** 保存阅读进度（防抖后调用） */
  async function persistProgress(): Promise<void> {
    if (!user.value || !carrier.value || !doc.value) return
    await services.storage.saveReadingProgress({
      carrierId: carrier.value.id,
      userId: user.value.id,
      position: `P${currentPage.value}`,
      percent: percent.value,
      updatedAt: new Date().toISOString()
    })
  }

  /** 翻到某页（越界自动夹取） */
  function goPage(pageNo: number): void {
    if (!totalPages.value) return
    currentPage.value = Math.min(Math.max(1, pageNo), totalPages.value)
  }

  /** 上一页 / 下一页 */
  function prevPage(): void {
    goPage(currentPage.value - 1)
  }
  function nextPage(): void {
    goPage(currentPage.value + 1)
  }

  /** 跳到某章（目录点击） */
  function goChapter(title: string): void {
    const item = doc.value?.toc.find((t) => t.title === title)
    if (item) goPage(item.pageNo)
  }

  /** 字号加减（夹在档位内） */
  function setFontSize(size: number): void {
    fontSize.value = size
    persistUi()
  }
  function largerFont(): void {
    const idx = FONT_SIZES.indexOf(fontSize.value as (typeof FONT_SIZES)[number])
    if (idx >= 0 && idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1])
  }
  function smallerFont(): void {
    const idx = FONT_SIZES.indexOf(fontSize.value as (typeof FONT_SIZES)[number])
    if (idx > 0) setFontSize(FONT_SIZES[idx - 1])
  }

  /** 切换阅读模式（翻页 / 连续滚动） */
  function setMode(m: ReadingMode): void {
    mode.value = m
    persistUi()
  }

  /** 本地持久化界面偏好 */
  function persistUi(): void {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ fontSize: fontSize.value, mode: mode.value }))
    } catch {
      // 本地存储失败不影响阅读
    }
  }

  /* ---------- 书签 ---------- */
  /** 加/删当前页书签 */
  async function toggleBookmark(): Promise<void> {
    if (!user.value || !carrier.value) return
    const exist = currentBookmark.value
    if (exist) {
      await services.storage.deleteBookmark(exist.id)
      bookmarks.value = bookmarks.value.filter((b) => b.id !== exist.id)
      return
    }
    const bm: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      carrierId: carrier.value.id,
      userId: user.value.id,
      pageNo: currentPage.value,
      createdAt: new Date().toISOString()
    }
    await services.storage.saveBookmark(bm)
    bookmarks.value = [...bookmarks.value, bm].sort((a, b) => a.pageNo - b.pageNo)
  }

  /* ---------- 标注 ---------- */
  /** 记录选中的文字（阅读区选中后调用） */
  function setSelection(text: string): void {
    selectionText.value = text.trim()
  }

  /** 清空选中/输入 */
  function clearSelection(): void {
    selectionText.value = ''
    annotationInput.value = ''
  }

  /** 保存一条标注（划线 or 笔记） */
  async function addAnnotation(kind: 'highlight' | 'note', text: string): Promise<void> {
    if (!user.value || !carrier.value || !text.trim()) return
    const ann: Annotation = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      carrierId: carrier.value.id,
      userId: user.value.id,
      location: `P${currentPage.value}`,
      kind,
      text: text.trim(),
      createdAt: new Date().toISOString()
    }
    await services.storage.saveAnnotation(ann)
    annotations.value = [...annotations.value, ann]
    clearSelection()
  }

  // 页码变化 → 防抖保存进度（800ms，避免连续翻页时频繁写库）
  let progressTimer: ReturnType<typeof setTimeout> | null = null
  watch(currentPage, () => {
    if (progressTimer) clearTimeout(progressTimer)
    progressTimer = setTimeout(() => {
      void persistProgress()
    }, 800)
  })

  /** 离开阅读器前立刻落一次进度（组件卸载时调用） */
  async function flushProgress(): Promise<void> {
    if (progressTimer) clearTimeout(progressTimer)
    await persistProgress()
  }

  return {
    // 数据
    carrier,
    doc,
    user,
    prefs,
    bookmarks,
    annotations,
    // 阅读状态
    currentPage,
    fontSize,
    mode,
    tocOpen,
    panelOpen,
    // 流程
    loading,
    error,
    selectionText,
    annotationInput,
    // 派生
    totalPages,
    page,
    chapter,
    percent,
    canPrev,
    canNext,
    currentBookmark,
    pageAnnotations,
    // 动作
    load,
    goPage,
    prevPage,
    nextPage,
    goChapter,
    setFontSize,
    largerFont,
    smallerFont,
    setMode,
    toggleBookmark,
    setSelection,
    clearSelection,
    addAnnotation,
    flushProgress
  }
})
