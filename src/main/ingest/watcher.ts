/**
 * 监控文件夹（主进程）。
 *
 * 用户把一个文件丢进「监控目录」，它就自动入库。
 * 这条路径的意义：真实使用中，人不是每次都想打开软件点"导入"，
 * 而是把找到的资料往一个文件夹里一扔，剩下的交给程序。
 *
 * 三个必须处理的现实问题：
 *
 * 1. **文件可能还没写完就被看到**。
 *    浏览器下载中的文件会先以 `.crdownload`/`.part` 出现，复制大文件时
 *    目标文件大小还在增长。直接读会得到半截文件、哈希也算错。
 *    解法：文件大小连续两次采样不变（stableMs）才算"写完了"，再入库。
 *
 * 2. **同一个文件会被触发多次事件**。
 *    复制一个文件通常触发 add + change + change。用 pending 表按路径去重，
 *    稳定后才真正导入一次。
 *
 * 3. **自身写入不能触发自己**。
 *    如果监控目录恰好是数据目录的一部分，库自己写文件会引发无限循环。
 *    所以启动时就排除数据根目录下的路径。
 */

import { watch, type FSWatcher } from 'chokidar'
import { stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { FileImporter } from './fileImporter'
import { getDataPaths } from '../storage/paths'

/** 文件大小稳定多久算写完（毫秒） */
const STABLE_MS = 1200
/** 稳定后确认的轮询间隔 */
const POLL_MS = 400
/** 单文件最大导入体积（超过就不自动入，防误丢系统镜像把库撑爆） */
const MAX_AUTO_BYTES = 2 * 1024 * 1024 * 1024

export class FolderWatcher {
  private watcher: FSWatcher | null = null
  private watchedDir: string | null = null
  /** 正在等待稳定的文件：路径 → 最近一次看到的大小 */
  private readonly pending = new Map<string, number>()
  /** 已导入过的路径+大小+时间，防同一文件反复触发 */
  private readonly done = new Set<string>()

  constructor(private readonly importer: FileImporter) {}

  /** 当前监视的目录 */
  current(): string | null {
    return this.watchedDir
  }

  /** 开始监视（自动停掉上一个） */
  async start(dir: string): Promise<void> {
    await this.stop()

    const abs = resolve(dir)
    // 不允许监视数据目录本身（否则库写文件会触发自己）
    const dataRoot = resolve(getDataPaths().root)
    if (abs === dataRoot || abs.startsWith(dataRoot + '\\') || abs.startsWith(dataRoot + '/')) {
      throw new Error('不能监视火种自己的数据目录（会把库文件当素材导入）')
    }

    this.watchedDir = abs
    this.watcher = watch(abs, {
      // 只看新增和变化，不看删除；忽略隐藏文件与临时下载后缀
      ignored: (p: string) => {
        const name = basename(p)
        if (name.startsWith('.')) return true
        return /\.(crdownload|part|tmp|download)$/i.test(name)
      },
      ignoreInitial: true,
      depth: 2,
      // 大目录下 chokidar 用轮询更稳（Windows 上原生事件会漏）
      usePolling: false,
      awaitWriteFinish: false // 稳定性我们自己判，避免 chokidar 内建等待过长
    })

    this.watcher.on('add', (p) => void this.onCandidate(p))
    this.watcher.on('change', (p) => void this.onCandidate(p))
    this.watcher.on('error', (err) => console.error('[watch] 监视出错：', err))

    console.log(`[watch] 开始监视：${abs}`)
  }

  /** 停止监视 */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.watchedDir = null
    this.pending.clear()
  }

  /**
   * 文件出现/变化时调用：等它大小稳定，再导入。
   *
   * 用"连续两次采样大小相同"判定稳定，而不是定时器——
   * 因为在复制 500MB 文件时，大小可能几百毫秒不变，定时器会误判。
   */
  private async onCandidate(filePath: string): Promise<void> {
    const abs = resolve(filePath)
    if (this.pending.has(abs)) {
      // 已在等待队列，只更新最近大小（说明还在写）
      try {
        const s = await stat(abs)
        this.pending.set(abs, s.size)
      } catch {
        /* 文件可能已被删除，忽略 */
      }
      return
    }
    this.pending.set(abs, -1)
    void this.waitStableThenImport(abs)
  }

  /** 轮询到大小稳定后导入 */
  private async waitStableThenImport(abs: string): Promise<void> {
    try {
      let lastSize = -1
      let stableSince = 0

      for (;;) {
        let size: number
        try {
          const s = await stat(abs)
          if (!s.isFile()) {
            this.pending.delete(abs)
            return
          }
          size = s.size
        } catch {
          // 文件消失（用户删了/移走了）
          this.pending.delete(abs)
          return
        }

        if (size === lastSize) {
          if (stableSince === 0) stableSince = Date.now()
          if (Date.now() - stableSince >= STABLE_MS) break
        } else {
          lastSize = size
          stableSince = 0
        }
        await new Promise((r) => setTimeout(r, POLL_MS))
      }

      const finalSize = lastSize
      this.pending.delete(abs)

      if (finalSize > MAX_AUTO_BYTES) {
        console.warn(`[watch] 跳过超大文件（${finalSize} 字节）：${abs}`)
        return
      }

      // 幂等键：路径 + 大小（同名不同内容会重新导入，同内容不会重复）
      const key = `${abs}::${finalSize}`
      if (this.done.has(key)) return
      this.done.add(key)

      const outcomes = await this.importer.importFiles([abs])
      for (const o of outcomes) {
        if (!o.ok) console.warn(`[watch] 自动导入失败：${abs} —— ${o.error}`)
        else if (o.duplicateOf) console.log(`[watch] 已在库中，跳过：${abs}`)
        else console.log(`[watch] 自动入库：${o.title}`)
      }
    } catch (err) {
      this.pending.delete(abs)
      console.error('[watch] 处理失败：', err)
    }
  }
}
