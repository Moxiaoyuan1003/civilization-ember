/**
 * 存储服务契约（Storage Service Contract）。
 *
 * 放在 shared 层，因为第 8 期起**两边都要用它**：
 * - 主进程：实现它（SQLite 真实实现）
 * - 渲染进程：消费它（IPC 代理把调用转发给主进程）
 *
 * 这是整个"可拔插"架构的核心抽象之一：
 * - 第 0-7 期：内存 Mock 实现，只为跑通页面。
 * - 第 8 期起：SQLite + 本地原文件仓（主进程）。
 * - 生产期：PostgreSQL + Qdrant/Milvus + 对象存储（也是主进程或独立服务）。
 * - 渲染层只依赖这个接口，换底层实现不动任何页面代码。
 *
 * 注意：这里的方法都是【返回 Promise】的异步接口，
 * 因为实现要跨 IPC / HTTP 访问常驻服务层进程（摄取层与服务层分离）。
 */

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
import type { Conversation, ChatMessage } from '@shared/types/chat'
import type { Bookmark } from '@shared/types/book'

export interface StorageService {
  /* ---------- 载体（全局共享） ---------- */
  /** 按条件列出载体 */
  listCarriers(filter?: CarrierFilter, sort?: CarrierSort): Promise<Carrier[]>
  /** 按 id 取单个载体 */
  getCarrier(id: string): Promise<Carrier | null>
  /** 新增载体（入库入口） */
  addCarrier(carrier: Carrier): Promise<Carrier>
  /** 全文 + 语义搜索，返回命中位置 */
  searchCarriers(query: string): Promise<SearchHit[]>
  /** 取某载体的转写（视频/音频） */
  getTranscript(carrierId: string): Promise<Transcript | null>

  /* ---------- 技术树（全局共享） ---------- */
  /** 取整棵技术树 */
  getTechTree(): Promise<TechTree>

  /* ---------- 布局快照（个人数据） ---------- */
  /** 列出某用户的所有布局快照 */
  listLayoutPresets(userId: string): Promise<LayoutPreset[]>
  /** 保存/更新一个布局快照 */
  saveLayoutPreset(preset: LayoutPreset): Promise<void>

  /* ---------- 用户（个人数据） ---------- */
  /** 取当前用户（无则创建默认用户） */
  getOrCreateUser(): Promise<User>
  /** 取某用户偏好（无则返回默认） */
  getPreferences(userId: string): Promise<UserPreferences>
  /** 保存用户偏好 */
  savePreferences(prefs: UserPreferences): Promise<void>

  /* ---------- 阅读/标注/掌握/收藏（个人数据） ---------- */
  /** 取某用户对某载体的阅读进度 */
  getReadingProgress(userId: string, carrierId: string): Promise<ReadingProgress | null>
  /** 保存阅读进度 */
  saveReadingProgress(progress: ReadingProgress): Promise<void>
  /** 列某用户对某载体的全部标注 */
  listAnnotations(userId: string, carrierId: string): Promise<Annotation[]>
  /** 保存一条标注 */
  saveAnnotation(annotation: Annotation): Promise<void>
  /** 列某用户全部掌握记录 */
  listMastery(userId: string): Promise<MasteryRecord[]>
  /** 保存一条掌握记录 */
  saveMastery(record: MasteryRecord): Promise<void>
  /** 列某用户全部收藏 */
  listFavorites(userId: string): Promise<Favorite[]>
  /** 保存一条收藏 */
  saveFavorite(fav: Favorite): Promise<void>

  /* ---------- 书签（个人数据） ---------- */
  /** 列某用户对某载体的全部书签 */
  listBookmarks(userId: string, carrierId: string): Promise<Bookmark[]>
  /** 保存一条书签 */
  saveBookmark(bookmark: Bookmark): Promise<void>
  /** 删除一条书签 */
  deleteBookmark(bookmarkId: string): Promise<void>

  /* ---------- 对话（个人数据） ---------- */
  /** 列某用户全部会话 */
  listConversations(userId: string): Promise<Conversation[]>
  /** 新建会话 */
  createConversation(conversation: Conversation): Promise<Conversation>
  /** 删除会话（连同其消息） */
  deleteConversation(conversationId: string): Promise<void>
  /** 取某会话全部消息 */
  listMessages(conversationId: string): Promise<ChatMessage[]>
  /** 保存一条消息 */
  saveMessage(message: ChatMessage): Promise<void>
}

/** StorageService 的全部方法名（IPC 层用它做白名单校验，防止渲染进程调用任意方法） */
export const STORAGE_METHODS = [
  'listCarriers',
  'getCarrier',
  'addCarrier',
  'searchCarriers',
  'getTranscript',
  'getTechTree',
  'listLayoutPresets',
  'saveLayoutPreset',
  'getOrCreateUser',
  'getPreferences',
  'savePreferences',
  'getReadingProgress',
  'saveReadingProgress',
  'listAnnotations',
  'saveAnnotation',
  'listMastery',
  'saveMastery',
  'listFavorites',
  'saveFavorite',
  'listBookmarks',
  'saveBookmark',
  'deleteBookmark',
  'listConversations',
  'createConversation',
  'deleteConversation',
  'listMessages',
  'saveMessage'
] as const

/** 方法名联合类型 */
export type StorageMethod = (typeof STORAGE_METHODS)[number]
