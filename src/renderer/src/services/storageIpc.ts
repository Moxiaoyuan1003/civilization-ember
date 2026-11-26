/**
 * 存储服务的 IPC 代理（渲染进程侧）。
 *
 * 第 8 期起，真正的存储实现在主进程（`src/main/storage/`），
 * 因为 SQLite 要写文件、且 WASM 版不允许两个进程同开一个库。
 *
 * 这个文件的唯一职责：把 27 个方法调用包成 IPC 请求发出去。
 * **接口签名与一期完全一致**（都来自 @shared/contracts/storage），
 * 所以一期的 8 个 store、几十个组件一行都不用改 ——
 * 这正是第 0 期"接口先行"的价值兑现。
 */

import type { StorageMethod, StorageService } from '@shared/contracts/storage'

/** 调不通主进程时的兜底错误（例如在浏览器里直接开渲染层页面） */
const NO_BRIDGE = '存储层不可用：未检测到主进程桥接（请在桌面应用中运行）'

/**
 * 发一次 IPC 调用并解包信封。
 *
 * 为什么要有信封：IPC 抛异常时 Electron 会把错误压成难辨认的字符串，
 * 主进程改成返回 {ok,error}，这里再还原成正常的 Promise reject，
 * 上层 store 的 try/catch 行为就与用内存 Mock 时完全一致。
 */
async function call<T>(method: StorageMethod, ...args: unknown[]): Promise<T> {
  const bridge = window.ember
  if (!bridge?.storageInvoke) throw new Error(NO_BRIDGE)

  const res = await bridge.storageInvoke(method, args)
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

/** 创建走 IPC 的存储服务 */
export function createIpcStorage(): StorageService {
  return {
    /* 载体 */
    listCarriers: (filter, sort) => call('listCarriers', filter, sort),
    getCarrier: (id) => call('getCarrier', id),
    addCarrier: (carrier) => call('addCarrier', carrier),
    searchCarriers: (query) => call('searchCarriers', query),
    getTranscript: (carrierId) => call('getTranscript', carrierId),

    /* 技术树 */
    getTechTree: () => call('getTechTree'),

    /* 布局快照 */
    listLayoutPresets: (userId) => call('listLayoutPresets', userId),
    saveLayoutPreset: (preset) => call('saveLayoutPreset', preset),

    /* 用户与偏好 */
    getOrCreateUser: () => call('getOrCreateUser'),
    getPreferences: (userId) => call('getPreferences', userId),
    savePreferences: (prefs) => call('savePreferences', prefs),

    /* 阅读进度 */
    getReadingProgress: (userId, carrierId) => call('getReadingProgress', userId, carrierId),
    saveReadingProgress: (progress) => call('saveReadingProgress', progress),

    /* 标注 */
    listAnnotations: (userId, carrierId) => call('listAnnotations', userId, carrierId),
    saveAnnotation: (annotation) => call('saveAnnotation', annotation),

    /* 已掌握 */
    listMastery: (userId) => call('listMastery', userId),
    saveMastery: (record) => call('saveMastery', record),

    /* 收藏 */
    listFavorites: (userId) => call('listFavorites', userId),
    saveFavorite: (fav) => call('saveFavorite', fav),

    /* 书签 */
    listBookmarks: (userId, carrierId) => call('listBookmarks', userId, carrierId),
    saveBookmark: (bookmark) => call('saveBookmark', bookmark),
    deleteBookmark: (bookmarkId) => call('deleteBookmark', bookmarkId),

    /* 对话 */
    listConversations: (userId) => call('listConversations', userId),
    createConversation: (conversation) => call('createConversation', conversation),
    deleteConversation: (conversationId) => call('deleteConversation', conversationId),
    listMessages: (conversationId) => call('listMessages', conversationId),
    saveMessage: (message) => call('saveMessage', message)
  }
}
