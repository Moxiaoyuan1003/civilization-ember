/**
 * 封面资源模块：集中管理载体封面图的本地资源。
 *
 * 封面图片全部为本地静态资源（src/renderer/src/assets/covers/ 下），
 * 通过 Vite 静态 import 打进产物——不受 CSP img-src 和外网可达性限制。
 * （2026-11-24 实测：openlibrary/wikimedia/archive.org 等外网图源不可达，
 *  仅 unsplash images CDN 可用，已下载 6 张贴合主题的实拍图。）
 */

import survivalCover from './survival.jpg'      // 帐篷营地（野外生存手册）
import fireCover from './fire.jpg'              // 篝火（钻木取火视频）
import metallurgyCover from './metallurgy.jpg'  // 焊接火花（冶金原理）
import ironOralCover from './iron-oral.jpg'     // 钢笔手稿（冶铁口述史）
import charcoalCover from './charcoal.jpg'      // 篝火夜色（木炭烧制百科页）
import steamCover from './steam.jpg'            // 机车列车（蒸汽机原理与制造）

/** 载体 id → 本地封面资源 URL 的注册表 */
export const localCoverRegistry: Record<string, string> = {
  'c-book-survival': survivalCover,
  'c-video-fire': fireCover,
  'c-book-metallurgy': metallurgyCover,
  'c-audio-iron': ironOralCover,
  'c-web-charcoal': charcoalCover,
  'c-book-steam': steamCover
}

/** 取某载体的封面：优先本地注册表，其次 coverUrl，最后 undefined（走占位） */
export function resolveCover(carrierId: string, coverUrl?: string): string | undefined {
  return localCoverRegistry[carrierId] ?? coverUrl
}
