/**
 * 首页 Dashboard 状态（Dashboard Store）。
 *
 * 职责：加载首页总览所需的所有数据，与具体组件解耦。
 * - 技术树进度：总节点数 + 已掌握数 + 各层分布。
 * - 缺口统计：missing-citation / missing-prerequisite 两类缺口计数。
 * - 继续阅读：阅读进度（接着上次读）+ 最近入库载体。
 * - 摄取进度：按 status 统计载体（pending/ingesting/ready/failed）。
 * - 收藏：收藏的载体（Feature Flag: features.favorites）。
 * - 卡片布局：顺序 + 显隐（个人偏好 dashboard.cardOrder/hiddenCards）。
 * - 全局搜索：搜载体 + 技术树节点 + 对话会话。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import { detectGaps } from '@/lib/gaps'
import { LAYERS } from '@/types/layer'
import type { TechTree, TechNode, TechGap } from '@/types/techTree'
import type { Carrier, CarrierStatus } from '@/types/carrier'
import type { User, UserPreferences, ReadingProgress, MasteryRecord, Favorite } from '@/types/user'
import type { Conversation } from '@/types/chat'
import { DEFAULT_PREFERENCES } from '@/types/user'

/** 首页卡片 id 列表（默认顺序） */
export const DASHBOARD_CARDS = [
  'progress', // 技术树进度
  'gaps', // 缺口统计
  'continue', // 继续阅读
  'ingest', // 摄取进度
  'favorites', // 收藏
  'quick' // 快捷入口
] as const

export type DashboardCardId = (typeof DASHBOARD_CARDS)[number]

/** 全局搜索结果（跨载体/节点/会话） */
export interface GlobalSearchResult {
  /** 结果类型 */
  kind: 'carrier' | 'node' | 'conversation'
  /** 展示标题 */
  title: string
  /** 副标题（作者/层名/模式等） */
  subtitle: string
  /** 跳转路径 */
  path: string
}

export const useDashboardStore = defineStore('dashboard', () => {
  /* ---------- 数据状态 ---------- */

  /** 当前用户 */
  const user = ref<User | null>(null)
  /** 用户偏好（卡片布局 + Feature Flags） */
  const prefs = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
  /** 技术树 */
  const tree = ref<TechTree | null>(null)
  /** 已掌握节点 id 集合 */
  const mastered = ref<Set<string>>(new Set())
  /** 缺口列表 */
  const gaps = ref<TechGap[]>([])
  /** 全部载体 */
  const carriers = ref<Carrier[]>([])
  /** 阅读进度（carrierId → 进度） */
  const progressMap = ref<Map<string, ReadingProgress>>(new Map())
  /** 收藏的载体 id 集合 */
  const favoriteIds = ref<Set<string>>(new Set())
  /** 全部会话 */
  const conversations = ref<Conversation[]>([])

  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)

  /* ---------- 派生状态 ---------- */

  /** 节点 id → 节点对象 */
  const nodeMap = computed<Map<string, TechNode>>(() => {
    const m = new Map<string, TechNode>()
    for (const n of tree.value?.nodes ?? []) m.set(n.id, n)
    return m
  })

  /** 载体 id → 载体对象 */
  const carrierMap = computed<Map<string, Carrier>>(() => {
    const m = new Map<string, Carrier>()
    for (const c of carriers.value) m.set(c.id, c)
    return m
  })

  /** 技术树总节点数 */
  const totalNodes = computed(() => tree.value?.nodes.length ?? 0)

  /** 已掌握节点数 */
  const masteredCount = computed(() => mastered.value.size)

  /** 技术树进度（0-1，总节点数 0 时返回 0） */
  const progress = computed(() =>
    totalNodes.value === 0 ? 0 : masteredCount.value / totalNodes.value
  )

  /** 各层节点分布（layer level → 节点数） */
  const layerCounts = computed<{ layer: number; name: string; count: number }[]>(() => {
    const counts = new Map<number, number>()
    for (const n of tree.value?.nodes ?? []) {
      counts.set(n.layer, (counts.get(n.layer) ?? 0) + 1)
    }
    return LAYERS.map((l) => ({ layer: l.level, name: l.name, count: counts.get(l.level) ?? 0 }))
      .filter((x) => x.count > 0)
  })

  /** 缺口统计（两类计数） */
  const gapCounts = computed(() => {
    const missingCitation = gaps.value.filter((g) => g.kind === 'missing-citation').length
    const missingPrereq = gaps.value.filter((g) => g.kind === 'missing-prerequisite').length
    return { total: gaps.value.length, missingCitation, missingPrereq }
  })

  /** 摄取进度：各状态载体计数 */
  const ingestStats = computed<{ status: CarrierStatus; label: string; count: number }[]>(() => {
    const labels: Record<CarrierStatus, string> = {
      pending: '待摄取',
      ingesting: '摄取中',
      ready: '已就绪',
      failed: '失败'
    }
    const counts = new Map<CarrierStatus, number>()
    for (const c of carriers.value) counts.set(c.status, (counts.get(c.status) ?? 0) + 1)
    return (Object.keys(labels) as CarrierStatus[]).map((s) => ({
      status: s,
      label: labels[s],
      count: counts.get(s) ?? 0
    }))
  })

  /** 继续阅读：有阅读进度的载体，按更新时间倒序 */
  const continueReading = computed<{ carrier: Carrier; progress: ReadingProgress }[]>(() => {
    const list: { carrier: Carrier; progress: ReadingProgress }[] = []
    for (const [carrierId, p] of progressMap.value) {
      const c = carrierMap.value.get(carrierId)
      if (c) list.push({ carrier: c, progress: p })
    }
    return list.sort((a, b) => b.progress.updatedAt.localeCompare(a.progress.updatedAt))
  })

  /** 最近入库载体（按 createdAt 倒序，最多 5 个） */
  const recentCarriers = computed<Carrier[]>(() =>
    [...carriers.value]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  )

  /** 收藏的载体对象列表（Feature Flag 控制） */
  const favoriteCarriers = computed<Carrier[]>(() =>
    [...favoriteIds.value]
      .map((id) => carrierMap.value.get(id))
      .filter((c): c is Carrier => !!c)
  )

  /** 卡片顺序（个人偏好 cardOrder 优先，未列出的排后面） */
  const visibleCards = computed<DashboardCardId[]>(() => {
    const order = prefs.value.dashboard.cardOrder
    const hidden = new Set(prefs.value.dashboard.hiddenCards)
    const ordered = [...order].filter((id) => DASHBOARD_CARDS.includes(id as DashboardCardId))
    const rest = DASHBOARD_CARDS.filter((id) => !ordered.includes(id))
    return [...ordered, ...rest].filter((id) => !hidden.has(id)) as DashboardCardId[]
  })

  /* ---------- 动作 ---------- */

  /** 加载首页全部数据 */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      const [u, t, list] = await Promise.all([
        services.storage.getOrCreateUser(),
        services.storage.getTechTree(),
        services.storage.listCarriers()
      ])
      user.value = u
      tree.value = t
      carriers.value = list
      gaps.value = detectGaps(t)

      const [p, masteryList, convs] = await Promise.all([
        services.storage.getPreferences(u.id),
        services.storage.listMastery(u.id),
        services.storage.listConversations(u.id)
      ])
      prefs.value = p
      mastered.value = new Set(masteryList.filter((m) => m.mastered).map((m) => m.nodeId))
      conversations.value = convs

      // 个人数据（阅读进度 + 收藏）
      const m = new Map<string, ReadingProgress>()
      for (const c of list) {
        const prog = await services.storage.getReadingProgress(u.id, c.id)
        if (prog) m.set(c.id, prog)
      }
      progressMap.value = m

      if (p.features.favorites) {
        const favs = await services.storage.listFavorites(u.id)
        favoriteIds.value = new Set(favs.map((f) => f.carrierId))
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 全局搜索：搜载体标题/作者/描述 + 技术树节点名/摘要 + 会话标题 */
  async function globalSearch(q: string): Promise<GlobalSearchResult[]> {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const results: GlobalSearchResult[] = []

    // 载体
    for (const c of carriers.value) {
      if (
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.authors?.some((a) => a.toLowerCase().includes(query))
      ) {
        results.push({
          kind: 'carrier',
          title: c.title,
          subtitle: c.authors?.[0] ?? c.description ?? '',
          path: `/carrier/${c.id}`
        })
      }
    }

    // 技术树节点
    for (const n of tree.value?.nodes ?? []) {
      if (n.name.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query)) {
        results.push({
          kind: 'node',
          title: n.name,
          subtitle: `${LAYERS[n.layer]?.name ?? 'L' + n.layer} · ${n.summary}`,
          path: `/tech-tree?nodeId=${n.id}`
        })
      }
    }

    // 会话
    for (const c of conversations.value) {
      if (c.title.toLowerCase().includes(query)) {
        results.push({
          kind: 'conversation',
          title: c.title,
          subtitle: 'AI 对话',
          path: '/chat'
        })
      }
    }

    return results
  }

  /** 更新卡片顺序（拖拽重排后调用，持久化） */
  async function reorderCards(order: DashboardCardId[]): Promise<void> {
    prefs.value.dashboard.cardOrder = [...order]
    if (user.value) await useServices().storage.savePreferences(prefs.value)
  }

  /** 切换某卡片显隐（持久化） */
  async function toggleCard(id: DashboardCardId): Promise<void> {
    const hidden = new Set(prefs.value.dashboard.hiddenCards)
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    prefs.value.dashboard.hiddenCards = [...hidden]
    if (user.value) await useServices().storage.savePreferences(prefs.value)
  }

  return {
    // 状态
    user,
    prefs,
    tree,
    mastered,
    gaps,
    carriers,
    progressMap,
    favoriteIds,
    conversations,
    loading,
    error,
    // 派生
    nodeMap,
    carrierMap,
    totalNodes,
    masteredCount,
    progress,
    layerCounts,
    gapCounts,
    ingestStats,
    continueReading,
    recentCarriers,
    favoriteCarriers,
    visibleCards,
    // 动作
    load,
    globalSearch,
    reorderCards,
    toggleCard
  }
})
