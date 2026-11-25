/**
 * Mock 媒体来源解析（MediaService 的内存实现）。
 *
 * 目前火种里只有两个音视频载体，它们的原片是按转写时间轴生成的演示素材，
 * 放在 renderer/public/media 下（打包后由 Vite 原样拷进产物）。
 *
 * 真实实现（第 8 期接 Node 侧）会变成：
 * 1. 按 carrier.filePath 去 data 目录里找文件；
 * 2. 找到就返回 file:// 路径；
 * 3. 找不到但转写还在 → 返回 transcript-only，播放器退化成"文字时间轴"。
 *
 * 这里刻意保留了"找不到文件"这条分支，因为文明断层的世界里，
 * 「片子丢了、文字还在」是常态，不是异常。
 */

import type { Carrier } from '@/types/carrier'
import type { MediaSource } from '@/types/media'
import type { MediaService } from '@/services/media'

/** 演示素材路径（相对 index.html，dev 与打包后都能取到） */
const MEDIA_FILES: Record<string, string> = {
  'c-video-fire': './media/fire-drilling.mp4',
  'c-audio-iron': './media/iron-oral-history.mp3'
}

/** 创建 Mock 媒体解析服务 */
export function createMockMedia(): MediaService {
  return {
    async resolve(carrier: Carrier): Promise<MediaSource> {
      const mediaType = carrier.type === 'video' ? 'video' : 'audio'

      // 非音视频载体不该走到这里
      if (carrier.type !== 'video' && carrier.type !== 'audio') {
        return {
          kind: 'transcript-only',
          mediaType: 'audio',
          note: '这个载体不是音视频，没有可播放的媒体。'
        }
      }

      const src = MEDIA_FILES[carrier.id]
      if (src) {
        // 模拟一次"检查文件是否存在"的异步延迟
        await new Promise((r) => setTimeout(r, 40))
        return {
          kind: 'local',
          src,
          mediaType,
          note: '原片已存入火种库，可直接播放。'
        }
      }

      // 没有原片：只能靠转写文字
      return {
        kind: 'transcript-only',
        mediaType,
        note: '原片已遗失，但转写下来的文字还在——可以按文字时间轴阅读。'
      }
    }
  }
}
