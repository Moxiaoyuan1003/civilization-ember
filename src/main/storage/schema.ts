/**
 * 数据库结构定义与迁移（主进程）。
 *
 * 设计要点：
 * 1. **带版本号、可增量迁移**：每期加字段就追加一个迁移步骤，不清库。
 *    当前版本号存在 `meta` 表的 `schema_version` 键里。
 * 2. **复合主键表达"个人数据"归属**：阅读进度、标注、掌握、收藏、书签
 *    都以 (user_id, carrier_id) 或 (user_id, node_id) 为键，
 *    天然支持"将来上多用户，各记各的"，不需要改表。
 * 3. **JSON 列存不定长结构**：tags / authors / citations / positions / features 等
 *    用 TEXT 存 JSON。SQLite 没有数组类型，而这些字段从不单独查询，
 *    只随着宿主记录整体读写，存 JSON 最简单可靠。
 *
 * 为什么不用 SQLite 的 FTS5 做全文索引：
 * FTS5 的内置分词器（unicode61）不会切中文，整句会被当成一个词。
 * 第 12 期做关键词检索时用自建倒排表 + BM25，中文用 bigram 切分。
 */

import type { Database } from 'node-sqlite3-wasm'

/** 当前数据库结构版本（每次改表结构都要 +1 并追加迁移） */
export const SCHEMA_VERSION = 1

/**
 * 迁移步骤表：数组下标即"目标版本号 - 1"。
 * 每次只执行 version 大于当前库版本的步骤。
 */
const MIGRATIONS: string[][] = [
  // v1：第 8 期初版结构
  [
    // ---- 元信息 ----
    `CREATE TABLE IF NOT EXISTS meta (
       key   TEXT PRIMARY KEY,
       value TEXT NOT NULL
     )`,

    // ---- 载体（全局共享） ----
    `CREATE TABLE IF NOT EXISTS carriers (
       id            TEXT PRIMARY KEY,
       title         TEXT NOT NULL,
       type          TEXT NOT NULL,
       format        TEXT,
       authors       TEXT,
       description   TEXT,
       size_bytes    INTEGER,
       duration_sec  INTEGER,
       cover_url     TEXT,
       tags          TEXT NOT NULL DEFAULT '[]',
       content_hash  TEXT NOT NULL,
       file_path     TEXT,
       source_url    TEXT,
       status        TEXT NOT NULL,
       ingested_at   TEXT,
       created_at    TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_carriers_type ON carriers(type)`,
    `CREATE INDEX IF NOT EXISTS idx_carriers_created ON carriers(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_carriers_hash ON carriers(content_hash)`,

    // ---- 转写（视频/音频的逐句文本） ----
    // 一个载体只有一份转写，segments 整体存 JSON（转写不是按句查询的对象）
    `CREATE TABLE IF NOT EXISTS transcripts (
       carrier_id TEXT PRIMARY KEY REFERENCES carriers(id) ON DELETE CASCADE,
       language   TEXT,
       segments   TEXT NOT NULL,
       raw_text   TEXT NOT NULL
     )`,

    // ---- 技术树（全局共享） ----
    `CREATE TABLE IF NOT EXISTS tech_nodes (
       id             TEXT PRIMARY KEY,
       name           TEXT NOT NULL,
       layer          INTEGER NOT NULL,
       summary        TEXT NOT NULL,
       description    TEXT,
       is_transversal INTEGER NOT NULL DEFAULT 0,
       citations      TEXT NOT NULL DEFAULT '[]',
       tags           TEXT
     )`,
    `CREATE TABLE IF NOT EXISTS tech_edges (
       id   TEXT PRIMARY KEY,
       from_node TEXT NOT NULL,
       to_node   TEXT NOT NULL,
       note      TEXT
     )`,
    `CREATE INDEX IF NOT EXISTS idx_edges_from ON tech_edges(from_node)`,
    `CREATE INDEX IF NOT EXISTS idx_edges_to ON tech_edges(to_node)`,

    // ---- 布局快照（个人数据；系统预设 user_id 为 NULL） ----
    `CREATE TABLE IF NOT EXISTS layout_presets (
       id         TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       is_system  INTEGER NOT NULL DEFAULT 0,
       user_id    TEXT,
       positions  TEXT NOT NULL DEFAULT '[]',
       updated_at TEXT NOT NULL
     )`,

    // ---- 用户与偏好（个人数据） ----
    `CREATE TABLE IF NOT EXISTS users (
       id         TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       created_at TEXT NOT NULL
     )`,
    // 偏好整条存成 JSON：字段多且会持续增加，拆列会让每次加字段都要迁移
    `CREATE TABLE IF NOT EXISTS preferences (
       user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       data    TEXT NOT NULL
     )`,

    // ---- 阅读进度（个人数据） ----
    `CREATE TABLE IF NOT EXISTS reading_progress (
       user_id    TEXT NOT NULL,
       carrier_id TEXT NOT NULL,
       position   TEXT NOT NULL,
       percent    REAL NOT NULL DEFAULT 0,
       updated_at TEXT NOT NULL,
       PRIMARY KEY (user_id, carrier_id)
     )`,

    // ---- 标注（个人数据） ----
    `CREATE TABLE IF NOT EXISTS annotations (
       id         TEXT PRIMARY KEY,
       user_id    TEXT NOT NULL,
       carrier_id TEXT NOT NULL,
       location   TEXT NOT NULL,
       kind       TEXT NOT NULL,
       text       TEXT NOT NULL,
       created_at TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_annot_carrier ON annotations(user_id, carrier_id)`,

    // ---- 已掌握（个人数据） ----
    `CREATE TABLE IF NOT EXISTS mastery (
       user_id    TEXT NOT NULL,
       node_id    TEXT NOT NULL,
       mastered   INTEGER NOT NULL DEFAULT 0,
       updated_at TEXT NOT NULL,
       PRIMARY KEY (user_id, node_id)
     )`,

    // ---- 收藏（个人数据） ----
    `CREATE TABLE IF NOT EXISTS favorites (
       user_id    TEXT NOT NULL,
       carrier_id TEXT NOT NULL,
       created_at TEXT NOT NULL,
       PRIMARY KEY (user_id, carrier_id)
     )`,

    // ---- 书签（个人数据） ----
    `CREATE TABLE IF NOT EXISTS bookmarks (
       id         TEXT PRIMARY KEY,
       user_id    TEXT NOT NULL,
       carrier_id TEXT NOT NULL,
       page_no    INTEGER NOT NULL,
       note       TEXT,
       created_at TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_bookmarks_carrier ON bookmarks(user_id, carrier_id)`,

    // ---- 对话会话（个人数据） ----
    `CREATE TABLE IF NOT EXISTS conversations (
       id         TEXT PRIMARY KEY,
       title      TEXT NOT NULL,
       mode       TEXT NOT NULL,
       user_id    TEXT NOT NULL,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC)`,

    // ---- 对话消息（个人数据） ----
    `CREATE TABLE IF NOT EXISTS messages (
       id              TEXT PRIMARY KEY,
       conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
       role            TEXT NOT NULL,
       content         TEXT NOT NULL,
       citations       TEXT,
       created_at      TEXT NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)`
  ]
]

/**
 * 执行迁移：把库结构升到 SCHEMA_VERSION。
 *
 * 流程：
 * 1. 确保 meta 表存在（它是版本号的载体，必须先有）
 * 2. 读当前版本（没有则视为 0）
 * 3. 依次执行 version 之后的每个迁移步骤，每步在事务里跑
 * 4. 写回新版本号
 *
 * @throws 迁移失败时抛错，由调用方决定是否重建库（宁可报错也不要半新半旧）
 */
export function migrate(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)

  const row = db.get(`SELECT value FROM meta WHERE key = 'schema_version'`) as
    | { value: string }
    | null
  const current = row ? Number(row.value) : 0

  if (current >= SCHEMA_VERSION) return

  for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
    const steps = MIGRATIONS[version - 1]
    if (!steps) continue
    db.exec('BEGIN')
    try {
      for (const sql of steps) db.exec(sql)
      db.run(`INSERT INTO meta (key, value) VALUES ('schema_version', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(version)])
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw new Error(`数据库迁移到 v${version} 失败：${(err as Error).message}`)
    }
  }
}
