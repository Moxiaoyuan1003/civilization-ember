/**
 * 存储层 IPC 通道（主进程侧）。
 *
 * 设计：
 * - **单一通道 + 方法名分发**，而不是 27 个 ipcMain.handle。
 *   取舍理由：27 个通道名要在 preload、主进程、代理三处各写一遍，
 *   漏一个就静默失效；单一通道 + 白名单常量，加方法只改契约文件。
 * - **白名单校验**：渲染进程传上来的方法名必须是 STORAGE_METHODS 里的，
 *   否则直接拒绝。渲染进程即使被注入恶意代码，也只能调这几个方法。
 * - **统一返回信封** `{ok:true,data}` / `{ok:false,error}`：
 *   IPC 抛异常会被序列化成难以辨认的字符串，包成信封后错误信息完整可读。
 */

import { ipcMain } from 'electron'
import { STORAGE_METHODS } from '@shared/contracts/storage'
import { getStorage } from './database'

/** IPC 通道名（preload 与渲染代理共用同一字符串） */
export const STORAGE_CHANNEL = 'storage:invoke'

const ALLOWED = new Set<string>(STORAGE_METHODS)

/** 注册存储 IPC 处理器。应在 app ready 后、创建窗口前调用。 */
export function registerStorageIpc(): void {
  // 提前把库打开、迁移、播种做完。这样第一次 UI 调用不用等冷启动，
  // 而且库有问题时能在启动日志里立刻看见，而不是等用户点到某个页面才炸。
  getStorage()

  ipcMain.handle(
    STORAGE_CHANNEL,
    async (_event, method: unknown, args: unknown[]): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> => {
      if (typeof method !== 'string' || !ALLOWED.has(method)) {
        return { ok: false, error: `未知的存储方法：${String(method)}` }
      }
      const { storage } = getStorage()
      try {
        // 方法名已在白名单内，这里做一次动态派发（TS 侧用 unknown 收口）
        const fn = (storage as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]
        const data = await fn.apply(storage, Array.isArray(args) ? args : [])
        return { ok: true, data }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // eslint-disable-next-line no-console
        console.error(`[storage] ${method} 失败：`, err)
        return { ok: false, error: msg }
      }
    }
  )
}
