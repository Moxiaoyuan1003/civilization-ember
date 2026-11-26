/**
 * 全局类型声明：把 preload 暴露的 ember 对象类型挂到 window 上，
 * 让渲染层能拿到类型提示。
 *
 * 三个 invoke 方法形状完全一致（单通道 + 方法名 + 参数数组 → 信封），
 * 差别只是打到哪个服务。加服务时两边同步加一行即可。
 */
export interface EmberApi {
  getVersion: () => string
  getPlatform: () => string
  windowControl: (action: 'minimize' | 'maximize-toggle' | 'close') => void
  /** 调用主进程存储服务的方法；返回统一信封 */
  storageInvoke: (
    method: string,
    args: unknown[]
  ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
  /** 调用主进程摄取服务的方法（选文件 / 导入 / 抓网页 / 监控目录） */
  ingestInvoke: (
    method: string,
    args: unknown[]
  ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
  /** 调用主进程文档服务（阅读器取正文） */
  documentInvoke: (
    method: string,
    args: unknown[]
  ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
}

declare global {
  interface Window {
    ember: EmberApi
  }
}
