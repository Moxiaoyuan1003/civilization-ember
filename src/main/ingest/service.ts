/**
 * 摄取服务的 IPC 实现（主进程）。
 *
 * 一个单例把 runner / importer / watcher 串起来：
 * 队列状态必须全局唯一，不能让两个 Importer 各自持有一个 runner，
 * 否则"同一时刻只跑一个任务"的假设就破了（会出现两条任务同时跑）。
 */

import type { Database } from 'node-sqlite3-wasm'
import { dialog, BrowserWindow } from 'electron'
import type { IngestService, ImportOutcome } from '@shared/contracts/ingest'
import type { IngestTask, StorageStats } from '@shared/types/ingest'
import { IngestRepo } from '../storage/ingestRepo'
import { IngestRunner } from './runner'
import { FileImporter } from './fileImporter'
import { WebImporter } from './webImporter'
import { FolderWatcher } from './watcher'

export class IngestServiceImpl implements IngestService {
  private readonly repo: IngestRepo
  readonly runner: IngestRunner
  readonly importer: FileImporter
  readonly webImporter: WebImporter
  readonly watcher: FolderWatcher

  constructor(db: Database) {
    this.repo = new IngestRepo(db)
    this.runner = new IngestRunner(db)
    this.importer = new FileImporter(db, this.runner)
    this.webImporter = new WebImporter(db, this.runner)
    this.watcher = new FolderWatcher(this.importer)
  }

  async listTasks(): Promise<IngestTask[]> {
    return this.repo.list()
  }

  async getTask(id: string): Promise<IngestTask | null> {
    return this.repo.get(id)
  }

  async pauseTask(id: string): Promise<void> {
    this.runner.pause(id)
  }

  async resumeTask(id: string): Promise<void> {
    this.runner.resume(id)
  }

  async retryTask(id: string): Promise<void> {
    this.runner.retry(id)
  }

  async cancelTask(id: string): Promise<void> {
    this.runner.cancel(id)
  }

  async getStorageStats(): Promise<StorageStats> {
    return this.repo.stats()
  }

  /* ------------------------ 真导入 ------------------------ */

  async pickFiles(): Promise<string[]> {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const filters = [
      { name: '所有支持的格式', extensions: SUPPORTED_EXTS },
      { name: '电子书', extensions: ['pdf', 'epub', 'txt', 'md'] },
      { name: '音视频', extensions: ['mp4', 'mkv', 'mov', 'webm', 'mp3', 'wav', 'm4a', 'flac'] },
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
    ]
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '选择要收入火种的文件',
          properties: ['openFile', 'multiSelections'],
          filters
        })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters })

    if (result.canceled) return []
    return result.filePaths
  }

  async importFiles(paths: string[]): Promise<ImportOutcome[]> {
    return this.importer.importFiles(paths)
  }

  async importUrl(url: string): Promise<ImportOutcome> {
    return this.webImporter.importUrl(url)
  }

  /* ------------------------ 监控文件夹 ------------------------ */

  async pickFolder(): Promise<string | null> {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '选择要监视的文件夹（丢进去的文件自动入库）',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  async watchFolder(dir: string): Promise<void> {
    await this.watcher.start(dir)
  }

  async unwatchFolder(): Promise<void> {
    await this.watcher.stop()
  }

  async getWatchedFolder(): Promise<string | null> {
    return this.watcher.current()
  }
}

/** 文件对话框里的扩展名列表（不带点） */
const SUPPORTED_EXTS = [
  'pdf',
  'epub',
  'txt',
  'md',
  'mp4',
  'mkv',
  'mov',
  'webm',
  'mp3',
  'wav',
  'm4a',
  'flac',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp'
]
