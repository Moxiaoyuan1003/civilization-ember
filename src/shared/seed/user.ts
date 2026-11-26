/**
 * Mock 用户与个人数据（当前用户 + 默认偏好 + 一条阅读进度示例）。
 *
 * 个人数据（阅读进度/标注/掌握/收藏/偏好/布局快照）都挂 user_id，
 * 这是"每个用户/设备各一份"的落点。
 */

import type { User, UserPreferences, ReadingProgress, Annotation, MasteryRecord, Favorite } from '@shared/types/user'
import { DEFAULT_PREFERENCES } from '@shared/types/user'
import type { LayoutPreset } from '@shared/types/layout'
import type { Bookmark } from '@shared/types/book'

/** Mock 当前用户（单机单用户场景，后续接多用户再扩展） */
export const mockUser: User = {
  id: 'u-local',
  name: '火种守护者',
  createdAt: '2026-01-01T00:00:00Z'
}

/** Mock 用户偏好（默认值） */
export const mockPreferences: UserPreferences = {
  ...DEFAULT_PREFERENCES,
  userId: 'u-local'
}
/**
 * Mock 阅读进度（示例：冶金原理读到第 4 页 / 6 页）。
 *
 * 注意 position 与 percent 必须和 `@shared/seed/documents` 里那本书的实际页数一致：
 * 第 8 期之前这里写的是「P180 / 65%」，但演示用的那本书只有 6 页，
 * 阅读器恢复进度时会把超范围的页码夹回第 1 页，首页于是显示「P1 · 17%」——
 * 数据自相矛盾。演示数据也该是自洽的，否则排查真问题时会被它误导。
 */
export const mockReadingProgress: ReadingProgress[] = [
  {
    carrierId: 'c-book-metallurgy',
    userId: 'u-local',
    position: 'P4',
    percent: 0.67,
    updatedAt: '2026-02-01T10:00:00Z'
  }
]

/** Mock 标注（示例：冶金原理第 4 页"淬火让铁变硬"那段的一条划线） */
export const mockAnnotations: Annotation[] = [
  {
    id: 'a1',
    carrierId: 'c-book-metallurgy',
    userId: 'u-local',
    location: 'P4',
    kind: 'highlight',
    text: '淬火温度需达到临界点以上，冷却速度决定硬度。',
    createdAt: '2026-02-01T10:05:00Z'
  }
]

/** Mock 掌握记录（示例：已掌握"取火"） */
export const mockMastery: MasteryRecord[] = [
  { nodeId: 'n-fire', userId: 'u-local', mastered: true, updatedAt: '2026-01-30T09:00:00Z' }
]

/** Mock 收藏（示例：收藏了蒸汽机原理） */
export const mockFavorites: Favorite[] = [
  { carrierId: 'c-book-steam', userId: 'u-local', createdAt: '2026-02-02T14:00:00Z' }
]

/** Mock 布局快照（系统自动分层预设，坐标后续由图库 autoLayout 生成时覆盖） */
export const mockLayoutPresets: LayoutPreset[] = [
  {
    id: 'lp-system',
    name: '系统自动分层',
    isSystem: true,
    userId: null,
    positions: [],
    updatedAt: '2026-01-01T00:00:00Z'
  }
]

/** Mock 书签（示例：冶金原理第 5 页，淬火回火那段） */
export const mockBookmarks: Bookmark[] = [
  {
    id: 'bm-1',
    carrierId: 'c-book-metallurgy',
    userId: 'u-local',
    pageNo: 5,
    note: '回火这段要反复看',
    createdAt: '2026-02-01T10:10:00Z'
  }
]
