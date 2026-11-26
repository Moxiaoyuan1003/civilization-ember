/**
 * 内容寻址原文件仓（主进程）。
 *
 * 为什么是"内容寻址"：
 * 火种库要能整体备份、整体搬走（用户将来可能挪到 NAS）。
 * 如果库里的记录只存"某台机器上的绝对路径"，搬一次就全断。
 * 所以真实入库的文件一律复制进 `objects/` 下，按文件内容的 SHA-256 命名：
 *
 *     objects/<hash 前2位>/<hash 3-4位>/<hash>.<扩展名>
 *
 * 好处有三个：
 * 1. **天然去重**：同一份 PDF 导入两次，哈希一样，磁盘上只有一份。
 * 2. **抗改名**：用户把硬盘上的原文件改名/移动/删掉，库里那份还在。
 * 3. **可校验**：内容被悄悄改过一个字节，哈希就对不上，能查出来。
 *
 * 分两级子目录（ab/cd）是为了避免单目录塞几十万个文件——
 * Windows 上单目录文件过多会让资源管理器和备份工具卡死。
 */

import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import type { Database } from 'node-sqlite3-wasm'
import { getDataPaths, ensureDataDirs } from '../storage/paths'

/** 一个已入库对象的信息 */
export interface StoredObject {
  /** 内容哈希（SHA-256 十六进制小写） */
  hash: string
  /** 字节数 */
  size: number
  /** 扩展名（含点，如 `.pdf`；没有则为空串） */
  ext: string
  /** 相对 objects/ 的路径，形如 `ab/cd/<hash>.pdf` */
  relPath: string
}

/** 计算文件内容的 SHA-256（流式，几百 MB 的文件也不会把内存吃满） */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** 由哈希与扩展名算出在 objects/ 下的相对路径 */
export function objectRelPath(hash: string, ext: string): string {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}${ext}`
}

/** 由哈希与扩展名算出绝对路径 */
export function objectAbsPath(hash: string, ext: string): string {
  return join(getDataPaths().objectsDir, objectRelPath(hash, ext))
}

/** 取文件大小，失败返回 0（不让一个坏文件打断整个导入流程） */
function sizeOf(p: string): number {
  try {
    return statSync(p).size
  } catch {
    return 0
  }
}

/**
 * 查找某个哈希对应的已存对象。
 * 扩展名没进哈希，所以按哈希前缀目录扫一遍文件名主干。
 */
export function findObjectByHash(hash: string): StoredObject | null {
  const dir = join(getDataPaths().objectsDir, hash.slice(0, 2), hash.slice(2, 4))
  if (!existsSync(dir)) return null
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return null
  }
  const hit = names.find((name) => name.startsWith(hash))
  if (!hit) return null
  return {
    hash,
    size: sizeOf(join(dir, hit)),
    ext: extname(hit),
    relPath: `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hit}`
  }
}

/**
 * 把一个文件收进对象仓。
 *
 * 已存在同哈希对象时**不重复拷贝**，直接返回既有信息——
 * 这就是去重生效的地方。
 */
export async function storeFile(sourcePath: string): Promise<StoredObject> {
  ensureDataDirs()
  const ext = extname(sourcePath).toLowerCase()

  const sourceStat = await stat(sourcePath)
  if (!sourceStat.isFile()) {
    throw new Error(`不是文件：${sourcePath}`)
  }

  const hash = await hashFile(sourcePath)
  const relPath = objectRelPath(hash, ext)
  const target = join(getDataPaths().objectsDir, relPath)

  if (existsSync(target)) {
    // 内容一致，已在库：不重复占用磁盘
    return { hash, size: sourceStat.size, ext, relPath }
  }

  await mkdir(dirname(target), { recursive: true })
  await copyFile(sourcePath, target)
  // 复制后核对大小，防止磁盘写满导致的半截文件被当成正常对象
  const copied = await stat(target)
  if (copied.size !== sourceStat.size) {
    throw new Error(`复制不完整：期望 ${sourceStat.size} 字节，实际 ${copied.size} 字节`)
  }

  return { hash, size: copied.size, ext, relPath }
}

/**
 * 把一段内存数据（网页下载的图片）存进对象仓。
 * 用于网页图片：它们没有本地源文件，是直接拿到的字节流。
 */
export async function storeBuffer(data: Uint8Array, ext: string): Promise<StoredObject> {
  ensureDataDirs()
  const hash = createHash('sha256').update(data).digest('hex')
  const relPath = objectRelPath(hash, ext)
  const target = join(getDataPaths().objectsDir, relPath)

  if (existsSync(target)) {
    return { hash, size: data.byteLength, ext, relPath }
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, data)
  return { hash, size: data.byteLength, ext, relPath }
}

/** 对象的绝对路径（渲染层要播放/显示时用文件 URL） */
export function objectFilePath(hash: string): string | null {
  const found = findObjectByHash(hash)
  if (!found) return null
  return join(getDataPaths().objectsDir, found.relPath)
}

/**
 * 把对象登记进 `objects` 表。
 *
 * 文件本身已经在磁盘上了，这张表是"索引"：谁在库里、多大、什么类型。
 * 存储统计页要算"实际占用多少磁盘"，只能靠这张表——
 * 光数 carrier 的 sizeBytes 会把演示数据那些虚构大小也算进去，
 * 数字漂亮但是假的。
 *
 * 用 `ON CONFLICT(hash) DO NOTHING`：同一份内容被导入两次时，
 * 第二次不该改写第一次的登记（大小本来就一样，改也没有意义）。
 */
export function registerObjectRow(
  // 用 node-sqlite3-wasm 的真实类型而不是手写的结构类型：
  // 它的 BindValues 有自己的联合类型，手写 `unknown[]` 反而不兼容
  db: Database,
  obj: StoredObject,
  mime: string
): void {
  db.run(
    `INSERT INTO objects (hash, size_bytes, mime, ext, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(hash) DO NOTHING`,
    [obj.hash, obj.size, mime, obj.ext, new Date().toISOString()]
  )
}

/** 由扩展名猜一个 MIME（登记用，不求精确，够统计页分类看即可） */
export function guessMime(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '')
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    epub: 'application/epub+zip',
    txt: 'text/plain',
    md: 'text/markdown',
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    html: 'text/html'
  }
  return map[e] ?? 'application/octet-stream'
}
