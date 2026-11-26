/**
 * Mock 存储服务（内存实现）。
 *
 * 用内存数组模拟"SQLite + 本地文件 + 向量库"，只为实现接口、跑通页面。
 * 后续接真实存储（SQLite→PostgreSQL、Chroma→Qdrant）时，替换整个实现即可。
 *
 * 全文搜索这里用最朴素的"字符串包含"模拟；
 * 语义搜索用关键词近义映射模拟（真正实现要接向量库）。
 */

import type { StorageService } from '@/services/storage'
import type { Carrier, CarrierFilter, CarrierSort, SearchHit, Transcript } from '@shared/types/carrier'
import type { TechTree } from '@shared/types/techTree'
import type { LayoutPreset } from '@shared/types/layout'
import type {
  Annotation,
  Favorite,
  MasteryRecord,
  ReadingProgress,
  User,
  UserPreferences
} from '@shared/types/user'
import { DEFAULT_PREFERENCES } from '@shared/types/user'
import type { Conversation, ChatMessage } from '@shared/types/chat'
import type { Bookmark } from '@shared/types/book'
import {
  mockCarriers,
  mockTranscripts,
  mockTechTree,
  mockUser,
  mockPreferences,
  mockReadingProgress,
  mockAnnotations,
  mockMastery,
  mockFavorites,
  mockLayoutPresets,
  mockConversations,
  mockMessages,
  mockBookmarks
} from '@/mocks/data'

/**
 * 语义搜索的近义映射：把口语化的问法映射到领域词，
 * 用来模拟"搜'变硬'命中'淬火'"这类语义检索。
 */
const SEMANTIC_MAP: Record<string, string[]> = {
  变硬: ['淬火', '硬化', '热处理'],
  变软: ['退火'],
  生火: ['取火', '钻木', '火种'],
  炼铁: ['冶铁', '冶炼', '铁'],
  转动: ['机械传动', '齿轮', '曲柄'],
  动力: ['蒸汽机', '蒸汽', '能源']
}

export function createMockStorage(): StorageService {
  // 用可变副本，让"保存/新增"在会话内生效
  const carriers: Carrier[] = [...mockCarriers]
  const transcripts: Transcript[] = [...mockTranscripts]
  const techTree: TechTree = structuredClone(mockTechTree)
  const layoutPresets: LayoutPreset[] = [...mockLayoutPresets]
  const preferences: UserPreferences = { ...mockPreferences }
  const readingProgress: ReadingProgress[] = [...mockReadingProgress]
  const annotations: Annotation[] = [...mockAnnotations]
  const mastery: MasteryRecord[] = [...mockMastery]
  const favorites: Favorite[] = [...mockFavorites]
  const conversations: Conversation[] = [...mockConversations]
  const messages: ChatMessage[] = [...mockMessages]
  const bookmarks: Bookmark[] = [...mockBookmarks]

  return {
    /* ---------- 载体 ---------- */
    async listCarriers(filter?: CarrierFilter, sort?: CarrierSort): Promise<Carrier[]> {
      let list = [...carriers]
      // 过滤
      if (filter?.type) list = list.filter((c) => c.type === filter.type)
      if (filter?.tag) list = list.filter((c) => c.tags.includes(filter.tag!))
      if (filter?.keyword) {
        const kw = filter.keyword.toLowerCase()
        list = list.filter(
          (c) =>
            c.title.toLowerCase().includes(kw) ||
            c.description?.toLowerCase().includes(kw) ||
            c.authors?.some((a) => a.toLowerCase().includes(kw))
        )
      }
      // 排序
      if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
      else if (sort === 'size') list.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
      else if (sort === 'progress') {
        // 按阅读进度排序（进度多的在前；无进度视为 0）
        const prog = new Map(readingProgress.map((p) => [p.carrierId, p.percent]))
        list.sort((a, b) => (prog.get(b.id) ?? 0) - (prog.get(a.id) ?? 0))
      } else {
        // 默认 recent：按入库时间倒序
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }
      return list
    },

    async getCarrier(id: string): Promise<Carrier | null> {
      return carriers.find((c) => c.id === id) ?? null
    },

    async addCarrier(carrier: Carrier): Promise<Carrier> {
      carriers.push(carrier)
      return carrier
    },

    async searchCarriers(query: string): Promise<SearchHit[]> {
      const hits: SearchHit[] = []
      const q = query.toLowerCase()

      // 全文搜索：命中标题/描述/标签/转写文本
      for (const c of carriers) {
        if (c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) {
          hits.push({
            carrierId: c.id,
            location: c.type === 'book' ? 'P1' : c.type === 'video' || c.type === 'audio' ? '00:00' : '§1',
            snippet: c.description ?? c.title,
            score: 0.9,
            source: 'fulltext'
          })
        }
        // 命中转写文本（视频/音频）
        const t = transcripts.find((x) => x.carrierId === c.id)
        if (t) {
          for (const seg of t.segments) {
            if (seg.text.toLowerCase().includes(q)) {
              const mm = Math.floor(seg.startSec / 60)
              const ss = Math.floor(seg.startSec % 60)
              hits.push({
                carrierId: c.id,
                location: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
                snippet: seg.text,
                score: 0.85,
                source: 'fulltext'
              })
            }
          }
        }
      }

      // 语义搜索：近义词映射命中（模拟向量检索"搜变硬命中淬火"）
      for (const [word, synonyms] of Object.entries(SEMANTIC_MAP)) {
        if (q.includes(word)) {
          for (const c of carriers) {
            for (const syn of synonyms) {
              if (c.description?.toLowerCase().includes(syn.toLowerCase())) {
                hits.push({
                  carrierId: c.id,
                  location: c.type === 'book' ? 'P156' : c.type === 'video' || c.type === 'audio' ? '01:10' : '§3',
                  snippet: `语义命中"${syn}"：${c.description ?? c.title}`,
                  score: 0.75,
                  source: 'semantic'
                })
              }
            }
          }
        }
      }

      // 去重（同载体同来源只留最高分）
      const seen = new Set<string>()
      return hits
        .filter((h) => {
          const key = `${h.carrierId}:${h.source}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => b.score - a.score)
    },

    async getTranscript(carrierId: string): Promise<Transcript | null> {
      return transcripts.find((t) => t.carrierId === carrierId) ?? null
    },

    /* ---------- 技术树 ---------- */
    async getTechTree(): Promise<TechTree> {
      return techTree
    },

    /* ---------- 布局快照 ---------- */
    async listLayoutPresets(userId: string): Promise<LayoutPreset[]> {
      return layoutPresets.filter((p) => p.userId === null || p.userId === userId)
    },

    async saveLayoutPreset(preset: LayoutPreset): Promise<void> {
      const idx = layoutPresets.findIndex((p) => p.id === preset.id)
      if (idx >= 0) layoutPresets[idx] = preset
      else layoutPresets.push(preset)
    },

    /* ---------- 用户 ---------- */
    async getOrCreateUser(): Promise<User> {
      return mockUser
    },

    async getPreferences(userId: string): Promise<UserPreferences> {
      if (preferences.userId === userId) return preferences
      return { ...DEFAULT_PREFERENCES, userId }
    },

    async savePreferences(prefs: UserPreferences): Promise<void> {
      Object.assign(preferences, prefs)
    },

    /* ---------- 阅读/标注/掌握/收藏 ---------- */
    async getReadingProgress(userId: string, carrierId: string): Promise<ReadingProgress | null> {
      return readingProgress.find((p) => p.userId === userId && p.carrierId === carrierId) ?? null
    },

    async saveReadingProgress(progress: ReadingProgress): Promise<void> {
      const idx = readingProgress.findIndex(
        (p) => p.userId === progress.userId && p.carrierId === progress.carrierId
      )
      if (idx >= 0) readingProgress[idx] = progress
      else readingProgress.push(progress)
    },

    async listAnnotations(userId: string, carrierId: string): Promise<Annotation[]> {
      return annotations.filter((a) => a.userId === userId && a.carrierId === carrierId)
    },

    async saveAnnotation(annotation: Annotation): Promise<void> {
      annotations.push(annotation)
    },

    async listMastery(userId: string): Promise<MasteryRecord[]> {
      return mastery.filter((m) => m.userId === userId)
    },

    async saveMastery(record: MasteryRecord): Promise<void> {
      const idx = mastery.findIndex((m) => m.userId === record.userId && m.nodeId === record.nodeId)
      if (idx >= 0) mastery[idx] = record
      else mastery.push(record)
    },

    async listFavorites(userId: string): Promise<Favorite[]> {
      return favorites.filter((f) => f.userId === userId)
    },

    async saveFavorite(fav: Favorite): Promise<void> {
      favorites.push(fav)
    },

    /* ---------- 书签 ---------- */
    async listBookmarks(userId: string, carrierId: string): Promise<Bookmark[]> {
      return bookmarks
        .filter((b) => b.userId === userId && b.carrierId === carrierId)
        .sort((a, b) => a.pageNo - b.pageNo)
    },

    async saveBookmark(bookmark: Bookmark): Promise<void> {
      const idx = bookmarks.findIndex((b) => b.id === bookmark.id)
      if (idx >= 0) bookmarks[idx] = bookmark
      else bookmarks.push(bookmark)
    },

    async deleteBookmark(bookmarkId: string): Promise<void> {
      const idx = bookmarks.findIndex((b) => b.id === bookmarkId)
      if (idx >= 0) bookmarks.splice(idx, 1)
    },

    /* ---------- 对话 ---------- */
    async listConversations(userId: string): Promise<Conversation[]> {
      return conversations.filter((c) => c.userId === userId)
    },

    async createConversation(conversation: Conversation): Promise<Conversation> {
      conversations.push(conversation)
      return conversation
    },

    async deleteConversation(conversationId: string): Promise<void> {
      const ci = conversations.findIndex((c) => c.id === conversationId)
      if (ci >= 0) conversations.splice(ci, 1)
      // 连同该会话的所有消息一起删除
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].conversationId === conversationId) messages.splice(i, 1)
      }
    },

    async listMessages(conversationId: string): Promise<ChatMessage[]> {
      return messages.filter((m) => m.conversationId === conversationId)
    },

    async saveMessage(message: ChatMessage): Promise<void> {
      messages.push(message)
    }
  }
}
