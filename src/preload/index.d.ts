/**
 * 全局类型声明：把 preload 暴露的 ember 对象类型挂到 window 上，
 * 让渲染层能拿到类型提示。
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
}

declare global {
  interface Window {
    ember: EmberApi
  }
}
