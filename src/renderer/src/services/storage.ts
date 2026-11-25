/**
 * 存储服务接口（Storage Service）。
 *
 * 这是整个"可拔插"架构的核心抽象之一：
 * - 开发期：SQLite + 本地文件 + Chroma（Mock 内存实现，见 services/mock）。
 * - 生产期：PostgreSQL + Qdrant/Milvus + 对象存储。
 * - 渲染层只依赖这个接口，换底层实现（SQLite→PostgreSQL、Chroma→Qdrant）
 *   不动任何页面代码，符合"换后端实现不动页面"。
 *
 * 注意：这里的方法都是【返回 Promise】的异步接口，
 * 因为生产实现要跨 IPC / HTTP 访问常驻服务层进程（摄取层与服务层分离）。
 */

import type { Carrier, CarrierFilter, CarrierSort, SearchHit, Transcript } from '@/types/carrier'
import type { TechTree } from '@/types/techTree'
import type { LayoutPreset } from '@/types/layout'
import type {
  Annotation,
  Favorite,
  MasteryRecord,
  ReadingProgress,
  User,
  UserPreferences
} from '@/types/user'
import type { Conversation, ChatMessage } from '@/types/chat'
import type { Bookmark } from '@/types/book'

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
