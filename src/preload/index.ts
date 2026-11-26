import { contextBridge, ipcRenderer } from 'electron'

/**
 * preload 脚本：渲染层与主进程之间的安全桥接层。
 *
 * 设计原则（对应"接口抽象、可拔插"）：
 * - 这里只暴露【最小、稳定、与业务无关】的能力，例如应用版本、平台信息、窗口控制。
 * - 未来需要的能力（读取文件、调用本地 AI / 转写进程等）都通过这里逐项显式暴露，
 *   渲染层永远不直接触碰 Node 能力，保证"换后端实现不动页面"。
 *
 * 第 8 期起多了一个 `storageInvoke`：存储层搬到了主进程（真 SQLite 要写文件、
 * 且 WASM 版不允许两个进程同开一个库），渲染进程通过它间接调用。
 * 注意这里**不做任何方法白名单校验**——校验放在主进程（见 src/main/storage/ipc.ts），
 * 因为 preload 运行在渲染进程一侧，信任它没有意义。
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
  },
  /**
   * 调用主进程存储服务的一个方法。
   * @param method StorageService 的方法名（主进程侧会校验是否在白名单内）
   * @param args 方法参数，按顺序传入
   * @returns 统一信封：{ok:true,data} 或 {ok:false,error}
   */
  storageInvoke: (
    method: string,
    args: unknown[]
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> =>
    ipcRenderer.invoke('storage:invoke', method, args),
  /**
   * 调用主进程摄取服务的一个方法（选文件/导入/抓网页/监控目录）。
   * 同样走"单通道 + 方法名分发"，白名单在主进程校验。
   */
  ingestInvoke: (
    method: string,
    args: unknown[]
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> =>
    ipcRenderer.invoke('ingest:invoke', method, args),
  /**
   * 调用主进程文档服务（阅读器取正文）。
   * 第 9 期起正文来自真实解析产物，不再是渲染层里的假数据。
   */
  documentInvoke: (
    method: string,
    args: unknown[]
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> =>
    ipcRenderer.invoke('document:invoke', method, args)
}

contextBridge.exposeInMainWorld('ember', api)

export type EmberApi = typeof api
