/**
 * 自定义协议 `ember-object://`（主进程）。
 *
 * 为什么需要它：真实入库的文件在对象仓里按哈希命名，路径形如
 * `%APPDATA%\civilization-ember\objects\ab\cd\<hash>.pdf`。
 * 渲染层要显示网页图片、播放导入的视频，就得让 `<img>` / `<video>`
 * 能引用这些文件。
 *
 * 两条常规做法都不合适：
 * - 直接给 `file://` 绝对路径：渲染层需要知道数据目录在哪、
 *   还会被 CSP 与跨源规则层层拦住，而且路径一泄露就把本机目录结构暴露给页面。
 * - 每次读成 base64 塞进 data URI：几十 MB 的视频会撑爆内存。
 *
 * 自定义协议最干净：页面只认 `ember-object://media/<hash>`，
 * 由主进程解析成真实路径再流式返回，页面永远看不到磁盘布局。
 *
 * 注意 `registerSchemesAsPrivileged` 必须在 app ready **之前**调用，
 * 否则 Chromium 不认这个协议（表现为图片静默不显示）。
 */

import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { findObjectByHash } from '../storage/objects'
import { join } from 'node:path'
import { getDataPaths } from '../storage/paths'

/** 协议名 */
export const OBJECT_SCHEME = 'ember-object'

/** 在 app ready 之前调用，把这个协议登记为"标准 + 安全 + 支持 fetch" */
export function registerObjectScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: OBJECT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true, // 视频要能拖动进度条就得支持流式
        bypassCSP: false
      }
    }
  ])
}

/**
 * 在 app ready 之后调用，注册实际的文件服务。
 *
 * 地址格式：`ember-object://media/<hash>`
 * - 主机名固定 `media`（scheme 是 standard 的，必须有主机名）；
 * - 路径就是内容哈希。
 */
export function registerObjectProtocol(): void {
  protocol.handle(OBJECT_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      // 形如 /<hash>，去掉前导斜杠
      const hash = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!/^[a-f0-9]{64}$/i.test(hash)) {
        return new Response('无效的对象哈希', { status: 400 })
      }
      const found = findObjectByHash(hash)
      if (!found) {
        return new Response('对象不存在', { status: 404 })
      }
      const abs = join(getDataPaths().objectsDir, found.relPath)
      // net.fetch 支持 file:// 并会正确处理 Range 请求（视频拖动必需）
      return await net.fetch(pathToFileURL(abs).toString())
    } catch (err) {
      console.error('[object-protocol] 读取失败：', err)
      return new Response('读取失败', { status: 500 })
    }
  })
}

/** 把对象哈希转成页面可用的 URL */
export function objectUrlOf(hash: string): string {
  return `${OBJECT_SCHEME}://media/${hash}`
}
