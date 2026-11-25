/**
 * 全局类型声明：把 preload 暴露的 ember 对象类型挂到 window 上，
 * 让渲染层能拿到类型提示。
 */
export interface EmberApi {
  getVersion: () => string
  getPlatform: () => string
  windowControl: (action: 'minimize' | 'maximize-toggle' | 'close') => void
}

declare global {
  interface Window {
    ember: EmberApi
  }
}
