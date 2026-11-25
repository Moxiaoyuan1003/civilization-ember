/**
 * 图书馆页状态（Library Store）。
 *
 * 职责：管理图书馆页所有"数据状态"与"业务动作"，与具体组件彻底解耦。
 * - 载体（carriers）= 全局共享，从 storage.listCarriers 读取。
 * - 收藏 / 阅读进度 = 个人数据（user_id 隔离）。
 * - 视图形态（卡片/列表）读偏好 libraryView，是"双模式"的落点。
 *
 * 搜索（全文 + 语义）走 storage.searchCarriers，返回 SearchHit 定位到书页/时间戳。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import type { Carrier, CarrierType, CarrierSort, SearchHit } from '@/types/carrier'
import type { User, UserPreferences, Favorite, ReadingProgress } from '@/types/user'
import type { TechTree, TechNode } from '@/types/techTree'
import { DEFAULT_PREFERENCES } from '@/types/user'

export const useLibraryStore = defineStore('library', () => {
  /* ---------- 数据状态 ---------- */

  /** 全部载体（全局共享，含过滤排序后的结果） */
  const carriers = ref<Carrier[]>([])
  /** 当前用户（个人数据归属） */
  const user = ref<User | null>(null)
  /** 当前用户偏好（图书馆默认视图 + Feature Flags） */
  const prefs = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
  /** 收藏的载体 id 集合（个人数据，Feature Flag: features.favorites） */
  const favoriteIds = ref<Set<string>>(new Set())
  /** 阅读进度（carrierId → percent，个人数据） */
  const progressMap = ref<Map<string, ReadingProgress>>(new Map())
  /** 技术树（用于计算"载体被哪些节点引用"的反向链接） */
  const techTree = ref<TechTree | null>(null)

  /* ---------- 过滤 / 排序 / 视图 ---------- */

  /** 类型过滤（null = 全部） */
  const typeFilter = ref<CarrierType | null>(null)
  /** 标签过滤（null = 全部） */
  const tagFilter = ref<string | null>(null)
  /** 关键词（顶栏搜索框，命中标题/描述/作者） */
  const keyword = ref('')
  /** 排序方式 */
  const sort = ref<CarrierSort>('recent')
  /** 视图形态（卡片/列表，读偏好，设置页可改） */
  const view = computed(() => prefs.value.libraryView)

  /* ---------- 搜索（独立全屏搜索页 + 顶栏共用） ---------- */

  /** 搜索结果（定位到书页/时间戳） */
  const searchHits = ref<SearchHit[]>([])
  /** 搜索关键词（结果页标题显示） */
  const searchQuery = ref('')
  /** 是否正在搜索 */
  const searching = ref(false)

  /* ---------- 选中 / 详情 ---------- */

  /** 当前选中载体 id（详情面板显示） */
  const selectedCarrierId = ref<string | null>(null)
  /** 入库对话框是否打开 */
  const importOpen = ref(false)

  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)

  /* ---------- 派生状态 ---------- */

  /** 载体 id → 载体对象 映射 */
  const carrierMap = computed<Map<string, Carrier>>(() => {
    const m = new Map<string, Carrier>()
    for (const c of carriers.value) m.set(c.id, c)
    return m
  })

  /** 当前选中的载体对象 */
  const selectedCarrier = computed<Carrier | null>(() =>
    selectedCarrierId.value ? carrierMap.value.get(selectedCarrierId.value) ?? null : null
  )

  /** 全部标签（过滤栏用，去重后按出现顺序） */
  const allTags = computed<string[]>(() => {
    const seen = new Set<string>()
    for (const c of carriers.value) for (const t of c.tags) if (!seen.has(t)) seen.add(t)
    return [...seen]
  })

  /** 引用某载体的技术树节点（反向链接，详情面板用） */
  function nodesCiting(carrierId: string): TechNode[] {
    const t = techTree.value
    if (!t) return []
    return t.nodes.filter((n) => n.citations.some((c) => c.carrierId === carrierId))
  }

  /* ---------- 动作 ---------- */

  /** 重新读取载体列表（受过滤/排序/关键词影响） */
  async function loadCarriers(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      carriers.value = await services.storage.listCarriers(
        {
          type: typeFilter.value ?? undefined,
          tag: tagFilter.value ?? undefined,
          keyword: keyword.value.trim() || undefined
        },
        sort.value
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 加载图书馆页全部数据（载体 + 用户 + 偏好 + 收藏 + 进度） */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      // 并行取载体 + 用户 + 技术树（反向链接用）
      const [list, u, tt] = await Promise.all([
        services.storage.listCarriers(
          { type: typeFilter.value ?? undefined, tag: tagFilter.value ?? undefined, keyword: keyword.value.trim() || undefined },
          sort.value
        ),
        services.storage.getOrCreateUser(),
        services.storage.getTechTree()
      ])
      carriers.value = list
      user.value = u
      techTree.value = tt

      // 个人数据（偏好 + 收藏 + 阅读进度）
      const p = await services.storage.getPreferences(u.id)
      prefs.value = p

      if (p.features.favorites) {
        const favs = await services.storage.listFavorites(u.id)
        favoriteIds.value = new Set(favs.map((f) => f.carrierId))
      }

      if (p.features.readingProgress) {
        const m = new Map<string, ReadingProgress>()
        for (const c of list) {
          const prog = await services.storage.getReadingProgress(u.id, c.id)
          if (prog) m.set(c.id, prog)
        }
        progressMap.value = m
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 设置类型过滤并重新加载 */
  async function setTypeFilter(t: CarrierType | null): Promise<void> {
    typeFilter.value = t
    await loadCarriers()
  }

  /** 设置标签过滤并重新加载 */
  async function setTagFilter(t: string | null): Promise<void> {
    tagFilter.value = t
    await loadCarriers()
  }

  /** 设置排序并重新加载 */
  async function setSort(s: CarrierSort): Promise<void> {
    sort.value = s
    await loadCarriers()
  }

  /** 设置视图形态（卡片/列表，持久化到偏好） */
  async function setView(v: 'card' | 'list'): Promise<void> {
    prefs.value.libraryView = v
    if (user.value) await useServices().storage.savePreferences(prefs.value)
  }

  /** 选中载体（详情面板显示） */
  function selectCarrier(carrierId: string | null): void {
    selectedCarrierId.value = carrierId
  }

  /** 切换收藏（个人数据，Feature Flag 控制入口显示） */
  async function toggleFavorite(carrierId: string): Promise<void> {
    if (!user.value) return
    const isFav = favoriteIds.value.has(carrierId)
    if (isFav) favoriteIds.value.delete(carrierId)
    else favoriteIds.value.add(carrierId)

    await useServices().storage.saveFavorite({
      carrierId,
      userId: user.value.id,
      createdAt: new Date().toISOString()
    })
  }

  /** 执行搜索（全文 + 语义） */
  async function search(q: string): Promise<void> {
    const query = q.trim()
    searchQuery.value = query
    if (!query) {
      searchHits.value = []
      return
    }
    searching.value = true
    try {
      searchHits.value = await useServices().storage.searchCarriers(query)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      searching.value = false
    }
  }

  /** 打开 / 关闭入库对话框 */
  function setImportOpen(open: boolean): void {
    importOpen.value = open
  }

  return {
    // 状态
    carriers,
    user,
    prefs,
    favoriteIds,
    progressMap,
    techTree,
    typeFilter,
    tagFilter,
    keyword,
    sort,
    view,
    searchHits,
    searchQuery,
    searching,
    selectedCarrierId,
    importOpen,
    loading,
    error,
    // 派生
    carrierMap,
    selectedCarrier,
    allTags,
    // 动作
    load,
    loadCarriers,
    nodesCiting,
    setTypeFilter,
    setTagFilter,
    setSort,
    setView,
    selectCarrier,
    toggleFavorite,
    search,
    setImportOpen
  }
})
