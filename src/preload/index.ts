import { contextBridge, ipcRenderer } from 'electron'

/**
 * preload 脚本：渲染层与主进程之间的安全桥接层。
 *
 * 设计原则（对应"接口抽象、可拔插"）：
 * - 这里只暴露【最小、稳定、与业务无关】的能力，例如应用版本、平台信息、窗口控制。
 * - 未来需要的能力（读取文件、调用本地 AI / 转写进程等）都通过这里逐项显式暴露，
 *   渲染层永远不直接触碰 Node 能力，保证"换后端实现不动页面"。
 */
const api = {
  /** 应用版本号 */
  getVersion: (): string => process.versions.electron ?? '',
  /** 当前运行平台：win32 / darwin / linux */
  getPlatform: (): string => process.platform,
  /**
   * 窗口控制（自绘标题栏用）：
   * 'minimize' 最小化 | 'maximize-toggle' 最大化/还原切换 | 'close' 关闭
   */
  windowControl: (action: 'minimize' | 'maximize-toggle' | 'close'): void => {
    ipcRenderer.send('window-control', action)
  }
}

contextBridge.exposeInMainWorld('ember', api)

export type EmberApi = typeof api
