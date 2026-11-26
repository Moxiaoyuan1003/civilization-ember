import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerStorageIpc } from './storage/ipc'
import { registerIngestIpc, getIngestService } from './storage/ingestIpc'
import { closeStorage } from './storage/database'
import { getDataPaths } from './storage/paths'
import { registerObjectScheme, registerObjectProtocol } from './storage/objectProtocol'

/**
 * 主窗口引用（保持全局，避免被垃圾回收提前关闭窗口）
 */
let mainWindow: BrowserWindow | null = null

/**
 * 固定应用名，进而固定 userData 目录（= 数据根目录的默认值）。
 *
 * 为什么显式设：Electron 默认从 package.json 的 name 推 app 名，
 * 但只有在"以目录方式启动"时才读得到。开发时用 `electron out/main/index.js`
 * 直接跑入口文件，就会退化成默认名 `Electron`，数据被写到
 * `%APPDATA%\Electron\` —— 跟双击 exe 启动时的 `%APPDATA%\civilization-ember\`
 * 变成两个不同的库，用户会以为"我的数据丢了"。
 * 显式命名后，无论怎么启动，数据永远在同一个目录。
 */
app.setName('civilization-ember')

/**
 * 自建协议必须在 app ready 之前登记，否则 Chromium 不认
 * （表现为 `<img src="ember-object://...">` 静默不显示，很难排查）。
 */
registerObjectScheme()

/**
 * 创建应用主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // 隐藏系统标题栏（含顶部菜单栏），由前端自绘标题栏替代（含窗口控制按钮）
    frame: false,
    // 深色背景，避免启动白屏闪烁
    backgroundColor: '#0d1117',
    title: '文明火种 · Civilization Ember',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 安全基线：不开启 node 集成，渲染层通过 preload 的受控桥接访问能力
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 渲染层加载完成后才显示窗口（避免白屏闪一下）
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外链一律交给系统浏览器打开，不在应用内新开窗口
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发态加载 dev server，生产态加载构建产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 存储层要先于窗口就绪：建库、迁移、首次播种都在这里完成。
  // 失败时把错误写进日志并照常开窗——宁可界面能开、数据报错，
  // 也不要因为库坏了整个应用打不开（用户至少还能导出/备份）。
  try {
    registerStorageIpc()
    // 摄取与文档服务依赖同一个数据库连接，必须在存储之后注册
    registerIngestIpc()
    // 自定义协议：让页面能用 ember-object://media/<hash> 引用对象仓里的文件
    registerObjectProtocol()
    // eslint-disable-next-line no-console
    console.log(`[storage] 数据目录：${getDataPaths().root}`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[storage] 初始化失败，应用将以无持久化模式运行：', err)
  }

  createWindow()

  // 自绘标题栏的窗口控制：最小化 / 最大化切换 / 关闭。
  // 渲染层通过 window.ember.windowControl() 调用，主进程在此统一处理。
  ipcMain.on('window-control', (_event, action: string) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    switch (action) {
      case 'minimize':
        win.minimize()
        break
      case 'maximize-toggle':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        break
      case 'close':
        win.close()
        break
    }
  })

  // macOS 约定：点击 Dock 图标且无窗口时重建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 除 macOS 外，所有窗口关闭即退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 退出前关闭数据库连接：WASM 版不 close 会留下未落盘的写缓冲。
// 同时停掉文件夹监视，避免退出过程中还在触发导入。
app.on('will-quit', () => {
  const ingest = getIngestService()
  if (ingest) void ingest.watcher.stop()
  closeStorage()
})
