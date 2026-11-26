/**
 * 数据目录解析（主进程）。
 *
 * 默认数据根目录 = `%APPDATA%\civilization-ember\`
 * （Electron 的 userData 目录，由 package.json 的 name 决定，不是硬编码用户名）。
 *
 * 留了一个覆盖口子：`<userData>/profile.json` 里可以写 `{ "dataRoot": "D:\\Ember" }`，
 * 将来设置页改数据位置时写这个文件，重启后生效。第 8 期先只读不写。
 */

import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

/** 数据目录集合 */
export interface DataPaths {
  /** 数据根目录（数据库、原文件、日志都在这下面） */
  root: string
  /** SQLite 数据库文件 */
  dbFile: string
  /** 原文件仓（内容寻址，objects/ab/cd/<sha256>.<ext>） */
  objectsDir: string
  /** 日志目录（按天滚动） */
  logsDir: string
}

let cached: DataPaths | null = null

/**
 * 解析数据根目录：优先 profile.json 里的 dataRoot，否则用 userData。
 * profile.json 损坏时不抛错，直接退回默认目录（不能让应用起不来）。
 */
function resolveDataRoot(): string {
  const userData = app.getPath('userData')
  const profileFile = join(userData, 'profile.json')
  try {
    if (existsSync(profileFile)) {
      const parsed = JSON.parse(readFileSync(profileFile, 'utf8')) as { dataRoot?: unknown }
      if (typeof parsed.dataRoot === 'string' && parsed.dataRoot.trim().length > 0) {
        return parsed.dataRoot.trim()
      }
    }
  } catch {
    // 忽略：配置损坏时用默认目录
  }
  return userData
}

/** 取数据目录集合（进程内缓存，避免反复算路径） */
export function getDataPaths(): DataPaths {
  if (cached) return cached
  const root = resolveDataRoot()
  cached = {
    root,
    dbFile: join(root, 'ember.db'),
    objectsDir: join(root, 'objects'),
    logsDir: join(root, 'logs')
  }
  return cached
}

/** 确保数据目录存在（首次启动时创建） */
export function ensureDataDirs(): DataPaths {
  const paths = getDataPaths()
  for (const dir of [paths.root, paths.objectsDir, paths.logsDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
  return paths
}
