/**
 * SQLite 存储实现（主进程）。
 *
 * 这个类实现 `@shared/contracts/storage` 的 StorageService 接口，
 * 行为对齐第 0-7 期的内存版 Mock（过滤、排序、去重、级联删除的语义都照抄），
 * 这样渲染层的 8 个 store 一行都不用改，只是数据从"内存"变成"磁盘"。
 *
 * 关于 node-sqlite3-wasm 的注意事项：
 * - `db.prepare()` 得到的 Statement 必须手动 finalize，否则内存泄漏；
 *   本文件统一用 db.all/get/run 便捷方法（它们内部自动 finalize）。
 * - 它是 WASM 单实例，两个进程同时开同一个库文件会锁死 ——
 *   所以存储只能活在主进程，渲染进程走 IPC。
 */

import type { Database } from 'node-sqlite3-wasm'
import type { StorageService } from '@shared/contracts/storage'
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
import type { ChatMessage, Conversation } from '@shared/types/chat'
import type { Bookmark, DocPage } from '@shared/types/book'
import { DEFAULT_PREFERENCES } from '@shared/types/user'
import {
  annotationFromRow,
  bookmarkFromRow,
  carrierFromRow,
  carrierToParams,
  conversationFromRow,
  favoriteFromRow,
  layoutPresetFromRow,
  masteryFromRow,
  messageFromRow,
  preferencesFromRow,
  readingProgressFromRow,
  rowHelpers,
  techTreeFromRows,
  transcriptFromRow,
  userFromRow,
  type Row
} from './rowmap'

/** 默认单用户 ID（与一期 seed 一致；二期仍单用户，多用户是纯增量） */
const LOCAL_USER_ID = 'u-local'
const LOCAL_USER_NAME = '火种守护者'

export class SqliteStorage implements StorageService {
  constructor(private readonly db: Database) {}

  /* ============================ 载体 ============================ */

  async listCarriers(filter?: CarrierFilter, sort?: CarrierSort): Promise<Carrier[]> {
    const where: string[] = []
    const params: (string | number)[] = []

    if (filter?.type) {
      where.push('type = ?')
      params.push(filter.type)
    }
    if (filter?.tag) {
      // tags 是 JSON 数组文本，用 LIKE 粗筛（第 12 期做真索引时再改）
      where.push(`tags LIKE ?`)
      params.push(`%"${filter.tag}"%`)
    }
    if (filter?.keyword) {
      where.push(`(lower(title) LIKE ? OR lower(coalesce(description,'')) LIKE ? OR lower(coalesce(authors,'')) LIKE ?)`)
      const kw = `%${filter.keyword.toLowerCase()}%`
      params.push(kw, kw, kw)
    }

    const sql = `SELECT * FROM carriers
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC`
    let list = (this.db.all(sql, params) as Row[]).map(carrierFromRow)

    // 排序在应用层做：progress 需要联表算阅读进度，title 要按中文/本地化比较
    switch (sort) {
      case 'title':
        list = list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
        break
      case 'size':
        list = list.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
        break
      case 'progress': {
        const rows = this.db.all(
          `SELECT carrier_id, percent FROM reading_progress WHERE user_id = ?`,
          [LOCAL_USER_ID]
        ) as Row[]
        const map = new Map(rows.map((r) => [String(r.carrier_id), Number(r.percent)]))
        list = list.sort((a, b) => (map.get(b.id) ?? -1) - (map.get(a.id) ?? -1))
        break
      }
      default:
        // recent：SQL 已按 created_at DESC 排好
        break
    }
    return list
  }

  async getCarrier(id: string): Promise<Carrier | null> {
    const row = this.db.get(`SELECT * FROM carriers WHERE id = ?`, [id]) as Row | null
    return row ? carrierFromRow(row) : null
  }

  async addCarrier(carrier: Carrier): Promise<Carrier> {
    const p = carrierToParams(carrier)
    this.db.run(
      `INSERT INTO carriers (id, title, type, format, authors, description, size_bytes,
                             duration_sec, cover_url, tags, content_hash, object_hash,
                             file_path, source_url, status, ingested_at, created_at)
       VALUES (:id, :title, :type, :format, :authors, :description, :size_bytes,
               :duration_sec, :cover_url, :tags, :content_hash, :object_hash,
               :file_path, :source_url, :status, :ingested_at, :created_at)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, type=excluded.type, format=excluded.format,
         authors=excluded.authors, description=excluded.description,
         size_bytes=excluded.size_bytes, duration_sec=excluded.duration_sec,
         cover_url=excluded.cover_url, tags=excluded.tags,
         content_hash=excluded.content_hash, object_hash=excluded.object_hash,
         file_path=excluded.file_path,
         source_url=excluded.source_url, status=excluded.status,
         ingested_at=excluded.ingested_at`,
      p
    )
    return carrier
  }

  /**
   * 搜索载体：标题/描述/作者 + 转写正文，返回带命中位置的 SearchHit。
   *
   * 第 8 期只做朴素子串匹配（保功能不退化），
   * 第 12 期换成倒排索引 + BM25 + 中文 bigram 切分。
   */
  async searchCarriers(query: string): Promise<SearchHit[]> {
    const q = query.trim()
    if (!q) return []
    const kw = `%${q.toLowerCase()}%`
    const hits: SearchHit[] = []

    const carriers = this.db.all(
      `SELECT * FROM carriers
       WHERE lower(title) LIKE ? OR lower(coalesce(description,'')) LIKE ?
          OR lower(coalesce(authors,'')) LIKE ?`,
      [kw, kw, kw]
    ) as Row[]

    for (const row of carriers) {
      const c = carrierFromRow(row)
      hits.push({
        carrierId: c.id,
        location: defaultLocation(c),
        snippet: c.description ?? c.title,
        score: 0.9,
        source: 'fulltext'
      })
    }

    // 转写正文命中：定位到具体时间戳
    const transcripts = this.db.all(`SELECT * FROM transcripts`) as Row[]
    for (const tRow of transcripts) {
      const t = transcriptFromRow(tRow)
      const carrierRow = this.db.get(`SELECT * FROM carriers WHERE id = ?`, [t.carrierId]) as Row | null
      if (!carrierRow) continue
      const c = carrierFromRow(carrierRow)
      for (const seg of t.segments) {
        if (seg.text.toLowerCase().includes(q.toLowerCase())) {
          hits.push({
            carrierId: c.id,
            location: formatSec(seg.startSec),
            snippet: seg.text,
            score: 0.85,
            source: 'fulltext'
          })
          break // 同一载体只报第一条命中的时间段，避免刷屏
        }
      }
    }

    // 正文命中：第 9 期导入的书已经解析进 documents 表了，
    // 搜不到正文等于"导进来的书只能看不能查"，所以这里顺手把正文也搜了。
    //
    // 现在是朴素的子串扫描（把整页正文读出来 `includes`），
    // 几千页的书会变慢——第 12 期换成 bigram 倒排 + BM25 时这段会被替掉。
    // 先用能跑的实现占位，比"搜不到自己刚导进去的内容"强。
    const docs = this.db.all(`SELECT carrier_id, pages FROM documents`) as Row[]
    for (const dRow of docs) {
      const carrierId = String(dRow.carrier_id ?? '')
      const carrierRow = this.db.get(`SELECT * FROM carriers WHERE id = ?`, [carrierId]) as Row | null
      if (!carrierRow) continue
      const pages = rowHelpers.parseJson<DocPage[]>(String(dRow.pages ?? '[]'), [])
      for (const page of pages) {
        const hitPara = page.paragraphs.find((p) => p.toLowerCase().includes(q.toLowerCase()))
        if (hitPara) {
          hits.push({
            carrierId,
            location: `P${page.pageNo}`,
            snippet: hitPara,
            score: 0.8,
            source: 'fulltext'
          })
          break // 同一载体只报第一处命中，避免一本书刷满结果列表
        }
      }
    }

    // 去重：同一载体+同一来源只保留最高分，再按分数倒序
    const best = new Map<string, SearchHit>()
    for (const h of hits) {
      const key = `${h.carrierId}:${h.source}`
      const prev = best.get(key)
      if (!prev || h.score > prev.score) best.set(key, h)
    }
    return [...best.values()].sort((a, b) => b.score - a.score)
  }

  async getTranscript(carrierId: string): Promise<Transcript | null> {
    const row = this.db.get(`SELECT * FROM transcripts WHERE carrier_id = ?`, [carrierId]) as Row | null
    return row ? transcriptFromRow(row) : null
  }

  /* ============================ 技术树 ============================ */

  async getTechTree(): Promise<TechTree> {
    const nodes = this.db.all(`SELECT * FROM tech_nodes`) as Row[]
    const edges = this.db.all(`SELECT * FROM tech_edges`) as Row[]
    return techTreeFromRows(nodes, edges)
  }

  /* ============================ 布局快照 ============================ */

  async listLayoutPresets(userId: string): Promise<LayoutPreset[]> {
    const rows = this.db.all(
      `SELECT * FROM layout_presets WHERE user_id IS NULL OR user_id = ? ORDER BY updated_at DESC`,
      [userId]
    ) as Row[]
    return rows.map(layoutPresetFromRow)
  }

  async saveLayoutPreset(preset: LayoutPreset): Promise<void> {
    this.db.run(
      `INSERT INTO layout_presets (id, name, is_system, user_id, positions, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, positions=excluded.positions, updated_at=excluded.updated_at`,
      [
        preset.id,
        preset.name,
        rowHelpers.boolToInt(preset.isSystem),
        preset.userId,
        JSON.stringify(preset.positions),
        preset.updatedAt
      ]
    )
  }

  /* ============================ 用户与偏好 ============================ */

  async getOrCreateUser(): Promise<User> {
    const row = this.db.get(`SELECT * FROM users WHERE id = ?`, [LOCAL_USER_ID]) as Row | null
    if (row) return userFromRow(row)
    const user: User = {
      id: LOCAL_USER_ID,
      name: LOCAL_USER_NAME,
      createdAt: new Date().toISOString()
    }
    this.db.run(`INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`, [
      user.id,
      user.name,
      user.createdAt
    ])
    return user
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const row = this.db.get(`SELECT * FROM preferences WHERE user_id = ?`, [userId]) as Row | null
    if (!row) return { ...DEFAULT_PREFERENCES, userId }
    const prefs = preferencesFromRow(row)
    // 兜底合并：库里存的是旧版本偏好时，新加字段用默认值补上
    return { ...DEFAULT_PREFERENCES, ...prefs, userId }
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    this.db.run(
      `INSERT INTO preferences (user_id, data) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`,
      [prefs.userId, JSON.stringify(prefs)]
    )
  }

  /* ============================ 阅读进度 ============================ */

  async getReadingProgress(userId: string, carrierId: string): Promise<ReadingProgress | null> {
    const row = this.db.get(
      `SELECT * FROM reading_progress WHERE user_id = ? AND carrier_id = ?`,
      [userId, carrierId]
    ) as Row | null
    return row ? readingProgressFromRow(row) : null
  }

  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    this.db.run(
      `INSERT INTO reading_progress (user_id, carrier_id, position, percent, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, carrier_id) DO UPDATE SET
         position=excluded.position, percent=excluded.percent, updated_at=excluded.updated_at`,
      [progress.userId, progress.carrierId, progress.position, progress.percent, progress.updatedAt]
    )
  }

  /* ============================ 标注 ============================ */

  async listAnnotations(userId: string, carrierId: string): Promise<Annotation[]> {
    const rows = this.db.all(
      `SELECT * FROM annotations WHERE user_id = ? AND carrier_id = ? ORDER BY created_at ASC`,
      [userId, carrierId]
    ) as Row[]
    return rows.map(annotationFromRow)
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    this.db.run(
      `INSERT INTO annotations (id, user_id, carrier_id, location, kind, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET text=excluded.text, location=excluded.location`,
      [
        annotation.id,
        annotation.userId,
        annotation.carrierId,
        annotation.location,
        annotation.kind,
        annotation.text,
        annotation.createdAt
      ]
    )
  }

  /* ============================ 已掌握 ============================ */

  async listMastery(userId: string): Promise<MasteryRecord[]> {
    const rows = this.db.all(`SELECT * FROM mastery WHERE user_id = ?`, [userId]) as Row[]
    return rows.map(masteryFromRow)
  }

  async saveMastery(record: MasteryRecord): Promise<void> {
    this.db.run(
      `INSERT INTO mastery (user_id, node_id, mastered, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, node_id) DO UPDATE SET
         mastered=excluded.mastered, updated_at=excluded.updated_at`,
      [record.userId, record.nodeId, rowHelpers.boolToInt(record.mastered), record.updatedAt]
    )
  }

  /* ============================ 收藏 ============================ */

  async listFavorites(userId: string): Promise<Favorite[]> {
    const rows = this.db.all(
      `SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    ) as Row[]
    return rows.map(favoriteFromRow)
  }

  async saveFavorite(fav: Favorite): Promise<void> {
    this.db.run(
      `INSERT INTO favorites (user_id, carrier_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, carrier_id) DO NOTHING`,
      [fav.userId, fav.carrierId, fav.createdAt]
    )
  }

  /* ============================ 书签 ============================ */

  async listBookmarks(userId: string, carrierId: string): Promise<Bookmark[]> {
    const rows = this.db.all(
      `SELECT * FROM bookmarks WHERE user_id = ? AND carrier_id = ? ORDER BY page_no ASC`,
      [userId, carrierId]
    ) as Row[]
    return rows.map(bookmarkFromRow)
  }

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    this.db.run(
      `INSERT INTO bookmarks (id, user_id, carrier_id, page_no, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET note=excluded.note, page_no=excluded.page_no`,
      [
        bookmark.id,
        bookmark.userId,
        bookmark.carrierId,
        bookmark.pageNo,
        bookmark.note ?? null,
        bookmark.createdAt
      ]
    )
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    this.db.run(`DELETE FROM bookmarks WHERE id = ?`, [bookmarkId])
  }

  /* ============================ 对话 ============================ */

  async listConversations(userId: string): Promise<Conversation[]> {
    const rows = this.db.all(
      `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`,
      [userId]
    ) as Row[]
    return rows.map(conversationFromRow)
  }

  async createConversation(conversation: Conversation): Promise<Conversation> {
    this.db.run(
      `INSERT INTO conversations (id, title, mode, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, mode=excluded.mode,
                                     updated_at=excluded.updated_at`,
      [
        conversation.id,
        conversation.title,
        conversation.mode,
        conversation.userId,
        conversation.createdAt,
        conversation.updatedAt
      ]
    )
    return conversation
  }

  async deleteConversation(conversationId: string): Promise<void> {
    // 外键 ON DELETE CASCADE 会连带删消息；仍显式删一次，防止外键被关掉的情况
    this.db.run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId])
    this.db.run(`DELETE FROM conversations WHERE id = ?`, [conversationId])
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = this.db.all(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    ) as Row[]
    return rows.map(messageFromRow)
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    this.db.run(
      `INSERT INTO messages (id, conversation_id, role, content, citations, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content=excluded.content, citations=excluded.citations`,
      [
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.citations ? JSON.stringify(message.citations) : null,
        message.createdAt
      ]
    )
  }
}

/* ============================ 小工具 ============================ */

/** 默认命中位置：书给页码占位，音视频给时间占位，其他给小节占位 */
function defaultLocation(c: Carrier): string {
  if (c.type === 'book') return 'P1'
  if (c.type === 'video' || c.type === 'audio') return '00:00'
  return '§1'
}

/** 秒 -> mm:ss */
function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
