import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

/**
 * 主窗口引用（保持全局，避免被垃圾回收提前关闭窗口）
 */
let mainWindow: BrowserWindow | null = null

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
