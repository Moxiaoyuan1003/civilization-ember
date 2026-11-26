/**
 * 技术树页状态（Tech Tree Store）。
 *
 * 职责：管理技术树页的所有"数据状态"与"业务动作"，与图库引擎彻底解耦。
 * - 数据（tree/positions/mastery/gaps/presets）都从这里读写。
 * - 图库引擎（G6）只负责"画"，由页面/composable 持有，不在这里出现。
 * - 这样换渲染引擎、换后端存储，本 store 代码零改动。
 *
 * 全局数据模型（宪法）：
 * - tree（节点/边） = 全局共享，从 storage.getTechTree() 读取。
 * - positions（坐标）/ mastery（已掌握）/ presets（布局快照）= 个人数据。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import { prerequisiteChain } from '@shared/types/techTree'
import type { TechTree, TechNode, TechGap } from '@shared/types/techTree'
import type { NodePosition, LayoutPreset } from '@shared/types/layout'
import type { User, UserPreferences } from '@shared/types/user'
import { DEFAULT_PREFERENCES } from '@shared/types/user'
import { autoLayout } from '@/lib/layout'
import { detectGaps } from '@/lib/gaps'

/** 系统自动分层预设的固定 id（永远存在，坐标每次重算） */
const SYSTEM_PRESET_ID = 'lp-system'

/** 手动整理预设的固定 id（用户拖拽后写入） */
const MANUAL_PRESET_ID = 'lp-manual'

export const useTechTreeStore = defineStore('techTree', () => {
  /* ---------- 数据状态 ---------- */

  /** 整棵技术树（全局共享） */
  const tree = ref<TechTree | null>(null)
  /** 当前用户（个人数据归属） */
  const user = ref<User | null>(null)
  /** 当前用户偏好（配色方案/详情面板形态等） */
  const prefs = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
  /** 已掌握节点 id 集合（个人数据） */
  const mastered = ref<Set<string>>(new Set())
  /** 缺口列表（由 lib/gaps.ts 算出） */
  const gaps = ref<TechGap[]>([])
  /** 布局快照列表（含系统预设 + 用户预设） */
  const presets = ref<LayoutPreset[]>([])
  /** 当前激活的布局快照 id */
  const activePresetId = ref<string>(SYSTEM_PRESET_ID)
  /** 当前画布坐标（渲染依据，来自激活快照或自动分层） */
  const positions = ref<NodePosition[]>([])

  /**
   * 布局渲染版本号：applyAutoLayout / switchPreset 时自增，驱动画布整帧重渲染。
   * 手动拖拽（applyManualPositions）不自增——图库已实时反映拖拽结果，
   * 只需持久化坐标，无需整帧重渲染（重渲染会丢高亮态）。
   */
  const layoutRenderKey = ref(0)

  /* ---------- 交互状态 ---------- */

  /** 当前选中的节点 id（详情面板显示它） */
  const selectedNodeId = ref<string | null>(null)
  /** 当前高亮前置链的目标节点 id（链路高亮） */
  const highlightedNodeId = ref<string | null>(null)
  /** 悬停节点（迷你卡显示它） */
  const hoveredNode = ref<TechNode | null>(null)
  /** 悬停指针的屏幕坐标（迷你卡定位） */
  const hoverPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })

  /** 缺口视图开关（顶栏切换，开启后缺口节点标红） */
  const gapViewOn = ref(true)

  /** 上下文菜单状态（右键节点弹出） */
  const contextMenu = ref<{ node: TechNode; x: number; y: number } | null>(null)

  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)

  /* ---------- 派生状态 ---------- */

  /** 节点 id → 节点对象 映射（详情/迷你卡反查） */
  const nodeMap = computed<Map<string, TechNode>>(() => {
    const m = new Map<string, TechNode>()
    for (const n of tree.value?.nodes ?? []) m.set(n.id, n)
    return m
  })

  /** 当前选中的节点对象 */
  const selectedNode = computed<TechNode | null>(() =>
    selectedNodeId.value ? nodeMap.value.get(selectedNodeId.value) ?? null : null
  )

  /** 当前高亮链上的节点 id 集合（页面可复用于图例/统计） */
  const highlightedChainIds = computed<Set<string>>(() => {
    if (!tree.value || !highlightedNodeId.value) return new Set()
    return new Set(prerequisiteChain(tree.value, highlightedNodeId.value))
  })

  /** 缺口节点 id 集合（缺口视图标红），受 gapViewOn 开关控制 */
  const gapNodeIds = computed<Set<string>>(() =>
    gapViewOn.value ? new Set(gaps.value.map((g) => g.nodeId)) : new Set<string>()
  )

  /** 配色方案（从偏好读，设置页改动后此处联动） */
  const colorScheme = computed(() => prefs.value.techTreeColor)

  /* ---------- 动作 ---------- */

  /**
   * 加载技术树页全部数据（树 + 用户 + 偏好 + 掌握 + 快照），
   * 并计算缺口 + 生成初始坐标。
   */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      // 并行取全局共享数据 + 个人数据
      const [t, u] = await Promise.all([services.storage.getTechTree(), services.storage.getOrCreateUser()])
      tree.value = t
      user.value = u

      // 个人数据（偏好/掌握/快照）
      const [p, masteryList, presetList] = await Promise.all([
        services.storage.getPreferences(u.id),
        services.storage.listMastery(u.id),
        services.storage.listLayoutPresets(u.id)
      ])
      prefs.value = p
      mastered.value = new Set(masteryList.filter((m) => m.mastered).map((m) => m.nodeId))
      presets.value = presetList

      // 计算缺口
      gaps.value = detectGaps(t)

      // 初始坐标：若激活的系统预设存在则重算自动分层，否则用自动分层兜底
      positions.value = autoLayout(t)
      activePresetId.value = SYSTEM_PRESET_ID
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 选中节点（详情面板显示） */
  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
    // 单击节点 = 注意力转移到该节点，旧的链路高亮随之失效：
    // 否则"高亮取火 → 点其他节点"时，其他节点仍保持灰色（dim 态）。
    // 需要高亮可再用详情面板/右键菜单的"高亮链路"按钮显式触发。
    highlightedNodeId.value = null
  }

  /** 清空选中 */
  function clearSelection(): void {
    selectedNodeId.value = null
  }

  /** 高亮某节点的前置链（点击"高亮"按钮或右键菜单触发） */
  function highlightChain(nodeId: string): void {
    highlightedNodeId.value = nodeId === highlightedNodeId.value ? null : nodeId
  }

  /** 清除链路高亮 */
  function clearHighlight(): void {
    highlightedNodeId.value = null
  }

  /** 设置悬停节点（迷你卡） */
  function setHover(node: TechNode | null, pos?: { x: number; y: number }): void {
    hoveredNode.value = node
    if (pos) hoverPos.value = pos
  }

  /** 打开上下文菜单（右键节点） */
  function openContextMenu(node: TechNode, pos: { x: number; y: number }): void {
    contextMenu.value = { node, x: pos.x, y: pos.y }
  }

  /** 关闭上下文菜单 */
  function closeContextMenu(): void {
    contextMenu.value = null
  }

  /** 切换某节点的"已掌握"状态（个人数据，持久化） */
  async function toggleMastery(nodeId: string): Promise<void> {
    if (!user.value) return
    const next = !mastered.value.has(nodeId)
    if (next) mastered.value.add(nodeId)
    else mastered.value.delete(nodeId)

    await useServices().storage.saveMastery({
      nodeId,
      userId: user.value.id,
      mastered: next,
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * 应用自动分层布局（系统预设）。
   * 重新用 lib/layout.ts 的纯函数算坐标，覆盖系统预设这一份。
   */
  function applyAutoLayout(): void {
    if (!tree.value) return
    positions.value = autoLayout(tree.value)
    activePresetId.value = SYSTEM_PRESET_ID
    layoutRenderKey.value++
    // 更新系统预设的坐标（isSystem 预设也存一份，供切换复用）
    const sys = presets.value.find((p) => p.id === SYSTEM_PRESET_ID)
    if (sys) {
      sys.positions = positions.value
      sys.updatedAt = new Date().toISOString()
    }
  }

  /**
   * 应用手动整理的坐标（用户拖拽后触发）。
   * 存成"我的整理"用户快照，与系统预设平级共存、互不覆盖。
   */
  async function applyManualPositions(nextPositions: NodePosition[]): Promise<void> {
    positions.value = nextPositions
    activePresetId.value = MANUAL_PRESET_ID
    if (!user.value) return

    const preset: LayoutPreset = {
      id: MANUAL_PRESET_ID,
      name: '我的整理',
      isSystem: false,
      userId: user.value.id,
      positions: nextPositions,
      updatedAt: new Date().toISOString()
    }
    // 覆盖已有手动快照（内存 + 持久化）
    const idx = presets.value.findIndex((p) => p.id === MANUAL_PRESET_ID)
    if (idx >= 0) presets.value[idx] = preset
    else presets.value.push(preset)

    await useServices().storage.saveLayoutPreset(preset)
  }

  /** 切换到某套布局快照（系统 / 用户） */
  function switchPreset(presetId: string): void {
    if (presetId === SYSTEM_PRESET_ID) {
      applyAutoLayout()
      return
    }
    const p = presets.value.find((x) => x.id === presetId)
    if (!p) return
    positions.value = p.positions
    activePresetId.value = presetId
    layoutRenderKey.value++
  }

  return {
    // 状态
    tree,
    user,
    prefs,
    mastered,
    gaps,
    presets,
    activePresetId,
    positions,
    selectedNodeId,
    highlightedNodeId,
    hoveredNode,
    hoverPos,
    loading,
    error,
    layoutRenderKey,
    gapViewOn,
    contextMenu,
    // 派生
    nodeMap,
    selectedNode,
    highlightedChainIds,
    gapNodeIds,
    colorScheme,
    // 动作
    load,
    selectNode,
    clearSelection,
    highlightChain,
    clearHighlight,
    setHover,
    openContextMenu,
    closeContextMenu,
    toggleMastery,
    applyAutoLayout,
    applyManualPositions,
    switchPreset
  }
})
