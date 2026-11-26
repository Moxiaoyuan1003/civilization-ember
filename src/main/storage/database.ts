/**
 * 数据库打开与初始化（主进程）。
 *
 * 职责：
 * 1. 按数据根路径打开 `ember.db`（不存在则创建）
 * 2. 执行结构迁移
 * 3. 首次启动时写入种子数据（那 7 个演示载体、技术树、默认用户）
 *
 * 为什么种子数据要留在库里而不是继续用内存 Mock：
 * 第 8 期之前，演示数据是"每次启动都重新生成"的，关掉就没了。
 * 现在它是真实记录，用户可以改、可以删、可以读，改动会留下来。
 */

import { existsSync } from 'node:fs'
import { Database } from 'node-sqlite3-wasm'
import { getDataPaths, ensureDataDirs } from './paths'
import { migrate } from './schema'
import { SqliteStorage } from './repository'
import {
  mockCarriers,
  mockTranscripts
} from '@shared/seed/carriers'
import { mockTechNodes, mockTechEdges } from '@shared/seed/techTree'
import {
  mockAnnotations,
  mockBookmarks,
  mockFavorites,
  mockLayoutPresets,
  mockMastery,
  mockPreferences,
  mockReadingProgress,
  mockUser
} from '@shared/seed/user'
import { mockConversations, mockMessages } from '@shared/seed/chat'
import { mockBookDocs } from '@shared/seed/documents'
import type { Carrier } from '@shared/types/carrier'

/** 单例：主进程里只开一个数据库连接（WASM 版不支持多连接同库） */
let db: Database | null = null
let storage: SqliteStorage | null = null

/**
 * 取得存储服务实例；首次调用时完成"建目录 → 开库 → 迁移 → 播种"。
 */
export function getStorage(): { db: Database; storage: SqliteStorage } {
  if (db && storage) return { db, storage }

  ensureDataDirs()
  const paths = getDataPaths()
  const fresh = !existsSync(paths.dbFile)

  const database = new Database(paths.dbFile)
  migrate(database)

  const repo = new SqliteStorage(database)

  // 首次建库才播种：有库说明用户已经在用了，不能覆盖
  if (fresh) {
    seedDatabase(database)
    // eslint-disable-next-line no-console
    console.log(`[storage] 首次启动，已写入种子数据：${paths.dbFile}`)
  } else {
    // 老库升级：第 9 期新增了 documents 表，演示书的正文要补进去，
    // 否则用户升级后打开阅读器会看到"还没解析出正文"，以为功能坏了。
    seedDocumentsIfEmpty(database)
  }

  db = database
  storage = repo
  return { db, storage }
}

/** 关闭数据库（应用退出时调用，WASM 版不 close 会泄漏） */
export function closeStorage(): void {
  if (db?.isOpen) db.close()
  db = null
  storage = null
}

/**
 * 老库升级：documents 表是第 9 期新增的，演示书的正文要补进去。
 *
 * 只在**表里一条都没有**时补，绝不覆盖用户已有的解析结果。
 * 这样第 8 期建的库升级到第 9 期后，阅读器立刻能读到那三本演示书。
 */
function seedDocumentsIfEmpty(database: Database): void {
  const row = database.get(`SELECT COUNT(*) AS n FROM documents`) as { n: number } | null
  if ((Number(row?.n) || 0) > 0) return
  const now = new Date().toISOString()
  database.exec('BEGIN')
  try {
    for (const doc of mockBookDocs) {
      database.run(
        `INSERT INTO documents (carrier_id, title, subtitle, pages, toc, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          doc.carrierId,
          doc.title,
          doc.subtitle ?? null,
          JSON.stringify(doc.pages),
          JSON.stringify(doc.toc),
          now
        ]
      )
    }
    database.exec('COMMIT')
    // eslint-disable-next-line no-console
    console.log(`[storage] 已为老库补齐演示书正文：${mockBookDocs.length} 本`)
  } catch (err) {
    database.exec('ROLLBACK')
    // eslint-disable-next-line no-console
    console.error('[storage] 补齐演示正文失败（不影响其它功能）：', err)
  }
}

/**
 * 写入种子数据。
 *
 * 种子里的载体 `filePath` 是占位假路径、`contentHash` 是占位串
 * （第 0-7 期造演示数据时留下的），这里原样保留：
 * 第 9 期做真摄取时，这些记录会被真实文件替换掉。
 */
function seedDatabase(database: Database): void {
  const now = new Date().toISOString()

  database.exec('BEGIN')
  try {
    /* ---- 用户与偏好 ---- */
    database.run(`INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`, [
      mockUser.id,
      mockUser.name,
      mockUser.createdAt
    ])
    database.run(`INSERT INTO preferences (user_id, data) VALUES (?, ?)`, [
      mockPreferences.userId,
      JSON.stringify(mockPreferences)
    ])

    /* ---- 载体 ---- */
    const insertCarrier = `INSERT INTO carriers (
        id, title, type, format, authors, description, size_bytes, duration_sec,
        cover_url, tags, content_hash, file_path, source_url, status, ingested_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    for (const c of mockCarriers as Carrier[]) {
      database.run(insertCarrier, [
        c.id,
        c.title,
        c.type,
        c.format ?? null,
        c.authors ? JSON.stringify(c.authors) : null,
        c.description ?? null,
        c.sizeBytes ?? null,
        c.durationSec ?? null,
        c.coverUrl ?? null,
        JSON.stringify(c.tags ?? []),
        c.contentHash,
        c.filePath ?? null,
        c.sourceUrl ?? null,
        c.status,
        c.ingestedAt ?? null,
        c.createdAt
      ])
    }

    /* ---- 转写 ---- */
    for (const t of mockTranscripts) {
      database.run(
        `INSERT INTO transcripts (carrier_id, language, segments, raw_text) VALUES (?, ?, ?, ?)`,
        [t.carrierId, t.language ?? null, JSON.stringify(t.segments), t.rawText]
      )
    }

    /* ---- 技术树 ---- */
    for (const n of mockTechNodes) {
      database.run(
        `INSERT INTO tech_nodes (id, name, layer, summary, description, is_transversal, citations, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          n.id,
          n.name,
          n.layer,
          n.summary,
          n.description ?? null,
          n.isTransversal ? 1 : 0,
          JSON.stringify(n.citations ?? []),
          n.tags ? JSON.stringify(n.tags) : null
        ]
      )
    }
    for (const e of mockTechEdges) {
      database.run(`INSERT INTO tech_edges (id, from_node, to_node, note) VALUES (?, ?, ?, ?)`, [
        e.id,
        e.from,
        e.to,
        e.note ?? null
      ])
    }

    /* ---- 布局快照（系统预设） ---- */
    for (const p of mockLayoutPresets) {
      database.run(
        `INSERT INTO layout_presets (id, name, is_system, user_id, positions, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          p.isSystem ? 1 : 0,
          p.userId,
          JSON.stringify(p.positions ?? []),
          p.updatedAt
        ]
      )
    }

    /* ---- 对话与消息 ---- */
    for (const conv of mockConversations) {
      database.run(
        `INSERT INTO conversations (id, title, mode, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [conv.id, conv.title, conv.mode, conv.userId, conv.createdAt, conv.updatedAt]
      )
    }
    for (const m of mockMessages) {
      database.run(
        `INSERT INTO messages (id, conversation_id, role, content, citations, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.conversationId,
          m.role,
          m.content,
          m.citations ? JSON.stringify(m.citations) : null,
          m.createdAt
        ]
      )
    }

    /* ---- 正文文档 ----
       第 9 期起阅读器读的是 documents 表（真解析产物），
       不再从渲染层的假数据里取。演示书的三本正文也一并落库，
       这样首次启动打开阅读器就能读到真内容，不是空白。 */
    for (const doc of mockBookDocs) {
      database.run(
        `INSERT INTO documents (carrier_id, title, subtitle, pages, toc, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          doc.carrierId,
          doc.title,
          doc.subtitle ?? null,
          JSON.stringify(doc.pages),
          JSON.stringify(doc.toc),
          now
        ]
      )
    }

    // 记录播种时间（排查问题时有用）
    database.run(`INSERT INTO meta (key, value) VALUES ('seeded_at', ?)`, [now])

    /* ---- 个人数据：进度 / 标注 / 掌握 / 收藏 / 书签 ----
       演示数据也一并落库，这样首次打开应用就有"读过一半的书、划过的一条线"，
       而不是全新空白——和一期演示效果一致，只是这次是真的存下来了。 */
    for (const p of mockReadingProgress) {
      database.run(
        `INSERT INTO reading_progress (user_id, carrier_id, position, percent, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [p.userId, p.carrierId, p.position, p.percent, p.updatedAt]
      )
    }
    for (const a of mockAnnotations) {
      database.run(
        `INSERT INTO annotations (id, user_id, carrier_id, location, kind, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.userId, a.carrierId, a.location, a.kind, a.text, a.createdAt]
      )
    }
    for (const m of mockMastery) {
      database.run(
        `INSERT INTO mastery (user_id, node_id, mastered, updated_at) VALUES (?, ?, ?, ?)`,
        [m.userId, m.nodeId, m.mastered ? 1 : 0, m.updatedAt]
      )
    }
    for (const f of mockFavorites) {
      database.run(`INSERT INTO favorites (user_id, carrier_id, created_at) VALUES (?, ?, ?)`, [
        f.userId,
        f.carrierId,
        f.createdAt
      ])
    }
    for (const b of mockBookmarks) {
      database.run(
        `INSERT INTO bookmarks (id, user_id, carrier_id, page_no, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [b.id, b.userId, b.carrierId, b.pageNo, b.note ?? null, b.createdAt]
      )
    }

    database.exec('COMMIT')
  } catch (err) {
    database.exec('ROLLBACK')
    throw new Error(`写入种子数据失败：${(err as Error).message}`)
  }
}
