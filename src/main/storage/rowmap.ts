/**
 * 行映射：SQLite 行（扁平、全部是基本类型）↔ 领域对象（嵌套、含数组与可选字段）。
 *
 * 为什么单独抽一个文件：
 * - 映射是纯函数，没有副作用，好读好测；
 * - repository.ts 只管 SQL，rowmap.ts 只管形状转换，职责不混；
 * - 将来加字段只改这里两处（toRow / fromRow），SQL 不用动。
 *
 * 约定：
 * - 数组/对象字段统一用 JSON TEXT 存，空值存 '[]' 或 NULL
 * - 布尔用 INTEGER 0/1
 * - 可选字段是 undefined 时存 NULL，读回来是 undefined（不是 null）
 */

import type { Carrier, CarrierType, CarrierStatus, Transcript, TranscriptSegment } from '@shared/types/carrier'
import type { TechNode, TechEdge, TechTree } from '@shared/types/techTree'
import type { LayerLevel } from '@shared/types/layer'
import type { LayoutPreset, NodePosition } from '@shared/types/layout'
import type { Annotation, Favorite, MasteryRecord, ReadingProgress, User, UserPreferences } from '@shared/types/user'
import type { ChatMessage, ChatRole, ChatMode, Conversation } from '@shared/types/chat'
import type { Bookmark } from '@shared/types/book'
import type { Citation } from '@shared/types/carrier'
import type { IngestTask } from '@shared/types/ingest'

/** SQLite 行的通用形状（列名 -> 基本值） */
export type Row = Record<string, string | number | bigint | Uint8Array | null>

/* ============================ 通用小工具 ============================ */

/** 安全解析 JSON 列；坏数据退回兜底值，不让一条脏记录搞崩整个列表 */
function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string' || text.length === 0) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/** 可选字符串：NULL / 空串 -> undefined */
function optStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  const s = String(v)
  return s.length === 0 ? undefined : s
}

/** 必填字符串 */
function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

/** 可数字段：NULL -> undefined */
function optNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined
  return Number(v)
}

/** 布尔：0/1 -> false/true */
function bool(v: unknown): boolean {
  return Number(v) === 1
}

/** 布尔写库：undefined -> 0 */
function boolToInt(v: boolean | undefined): number {
  return v ? 1 : 0
}

/* ============================ 载体 ============================ */

/** carriers 表一行 -> Carrier */
export function carrierFromRow(row: Row): Carrier {
  return {
    id: str(row.id),
    title: str(row.title),
    type: str(row.type) as CarrierType,
    format: optStr(row.format),
    authors: parseJson<string[] | undefined>(row.authors, undefined),
    description: optStr(row.description),
    sizeBytes: optNum(row.size_bytes),
    durationSec: optNum(row.duration_sec),
    coverUrl: optStr(row.cover_url),
    tags: parseJson<string[]>(row.tags, []),
    contentHash: str(row.content_hash),
    objectHash: optStr(row.object_hash),
    filePath: optStr(row.file_path),
    sourceUrl: optStr(row.source_url),
    status: str(row.status) as CarrierStatus,
    ingestedAt: optStr(row.ingested_at),
    createdAt: str(row.created_at)
  }
}

/** Carrier -> carriers 表的列值（命名参数，键名与 SQL 里的 :name 对应） */
export function carrierToParams(c: Carrier): Record<string, string | number | null> {
  return {
    ':id': c.id,
    ':title': c.title,
    ':type': c.type,
    ':format': c.format ?? null,
    ':authors': c.authors ? JSON.stringify(c.authors) : null,
    ':description': c.description ?? null,
    ':size_bytes': c.sizeBytes ?? null,
    ':duration_sec': c.durationSec ?? null,
    ':cover_url': c.coverUrl ?? null,
    ':tags': JSON.stringify(c.tags ?? []),
    ':content_hash': c.contentHash,
    ':object_hash': c.objectHash ?? null,
    ':file_path': c.filePath ?? null,
    ':source_url': c.sourceUrl ?? null,
    ':status': c.status,
    ':ingested_at': c.ingestedAt ?? null,
    ':created_at': c.createdAt
  }
}

/* ============================ 转写 ============================ */

/** transcripts 表一行 -> Transcript */
export function transcriptFromRow(row: Row): Transcript {
  return {
    carrierId: str(row.carrier_id),
    language: optStr(row.language),
    segments: parseJson<TranscriptSegment[]>(row.segments, []),
    rawText: str(row.raw_text)
  }
}

/* ============================ 技术树 ============================ */

/** tech_nodes 表一行 -> TechNode */
export function techNodeFromRow(row: Row): TechNode {
  return {
    id: str(row.id),
    name: str(row.name),
    layer: Number(row.layer) as LayerLevel,
    summary: str(row.summary),
    description: optStr(row.description),
    isTransversal: bool(row.is_transversal),
    citations: parseJson<Citation[]>(row.citations, []),
    tags: parseJson<string[] | undefined>(row.tags, undefined)
  }
}

/** tech_edges 表一行 -> TechEdge */
export function techEdgeFromRow(row: Row): TechEdge {
  return {
    id: str(row.id),
    from: str(row.from_node),
    to: str(row.to_node),
    note: optStr(row.note)
  }
}

/** 节点 + 边 -> 整棵树 */
export function techTreeFromRows(nodeRows: Row[], edgeRows: Row[]): TechTree {
  return {
    nodes: nodeRows.map(techNodeFromRow),
    edges: edgeRows.map(techEdgeFromRow)
  }
}

/* ============================ 布局快照 ============================ */

/** layout_presets 表一行 -> LayoutPreset */
export function layoutPresetFromRow(row: Row): LayoutPreset {
  return {
    id: str(row.id),
    name: str(row.name),
    isSystem: bool(row.is_system),
    userId: row.user_id === null ? null : String(row.user_id),
    positions: parseJson<NodePosition[]>(row.positions, []),
    updatedAt: str(row.updated_at)
  }
}

/* ============================ 用户与偏好 ============================ */

/** users 表一行 -> User */
export function userFromRow(row: Row): User {
  return {
    id: str(row.id),
    name: str(row.name),
    createdAt: str(row.created_at)
  }
}

/** 偏好整体存 JSON，读出即对象 */
export function preferencesFromRow(row: Row): UserPreferences {
  return parseJson<UserPreferences>(row.data, {} as UserPreferences)
}

/* ============================ 个人数据 ============================ */

/** reading_progress 表一行 -> ReadingProgress */
export function readingProgressFromRow(row: Row): ReadingProgress {
  return {
    carrierId: str(row.carrier_id),
    userId: str(row.user_id),
    position: str(row.position),
    percent: Number(row.percent),
    updatedAt: str(row.updated_at)
  }
}

/** annotations 表一行 -> Annotation */
export function annotationFromRow(row: Row): Annotation {
  return {
    id: str(row.id),
    carrierId: str(row.carrier_id),
    userId: str(row.user_id),
    location: str(row.location),
    kind: str(row.kind) as Annotation['kind'],
    text: str(row.text),
    createdAt: str(row.created_at)
  }
}

/** mastery 表一行 -> MasteryRecord */
export function masteryFromRow(row: Row): MasteryRecord {
  return {
    nodeId: str(row.node_id),
    userId: str(row.user_id),
    mastered: bool(row.mastered),
    updatedAt: str(row.updated_at)
  }
}

/** favorites 表一行 -> Favorite */
export function favoriteFromRow(row: Row): Favorite {
  return {
    carrierId: str(row.carrier_id),
    userId: str(row.user_id),
    createdAt: str(row.created_at)
  }
}

/** bookmarks 表一行 -> Bookmark */
export function bookmarkFromRow(row: Row): Bookmark {
  return {
    id: str(row.id),
    carrierId: str(row.carrier_id),
    userId: str(row.user_id),
    pageNo: Number(row.page_no),
    note: optStr(row.note),
    createdAt: str(row.created_at)
  }
}

/* ============================ 对话 ============================ */

/** conversations 表一行 -> Conversation */
export function conversationFromRow(row: Row): Conversation {
  return {
    id: str(row.id),
    title: str(row.title),
    mode: str(row.mode) as ChatMode,
    userId: str(row.user_id),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at)
  }
}

/** messages 表一行 -> ChatMessage */
export function messageFromRow(row: Row): ChatMessage {
  return {
    id: str(row.id),
    conversationId: str(row.conversation_id),
    role: str(row.role) as ChatRole,
    content: str(row.content),
    citations: parseJson<Citation[] | undefined>(row.citations, undefined),
    createdAt: str(row.created_at)
  }
}

/* ============================ 摄取任务 ============================ */

/** ingest_tasks 表一行 -> IngestTask */
export function ingestTaskFromRow(row: Row): IngestTask {
  return {
    id: str(row.id),
    carrierId: str(row.carrier_id),
    carrierTitle: str(row.carrier_title),
    carrierType: str(row.carrier_type) as IngestTask['carrierType'],
    status: str(row.status) as IngestTask['status'],
    stage: str(row.stage) as IngestTask['stage'],
    progress: Number(row.progress) || 0,
    checkpoint: parseJson<IngestTask['checkpoint']>(row.checkpoint, []),
    skippedStages: parseJson<IngestTask['skippedStages']>(row.skipped_stages, []),
    note: optStr(row.note),
    resumable: bool(row.resumable),
    attempts: Number(row.attempts) || 0,
    maxAttempts: Number(row.max_attempts) || 3,
    lastError: optStr(row.last_error),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at)
  }
}

/** IngestTask -> 命名参数（写库用） */
export function ingestTaskToParams(t: IngestTask): Record<string, string | number | null> {
  return {
    ':id': t.id,
    ':carrier_id': t.carrierId,
    ':carrier_title': t.carrierTitle,
    ':carrier_type': t.carrierType,
    ':status': t.status,
    ':stage': t.stage,
    ':progress': t.progress,
    ':checkpoint': JSON.stringify(t.checkpoint),
    ':skipped_stages': JSON.stringify(t.skippedStages),
    ':note': t.note ?? null,
    ':resumable': boolToInt(t.resumable),
    ':attempts': t.attempts,
    ':max_attempts': t.maxAttempts,
    ':last_error': t.lastError ?? null,
    ':created_at': t.createdAt,
    ':updated_at': t.updatedAt
  }
}

/** 供 repository 复用的小工具（避免两份实现） */
export const rowHelpers = { boolToInt, parseJson, str, optStr }
