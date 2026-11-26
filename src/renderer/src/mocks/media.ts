/**
 * 媒体来源解析（MediaService 的实现）。
 *
 * 判断顺序（也就是"这个片子还在不在"的完整答案）：
 *
 * 1. **载体带 objectHash** → 真入库的音视频，走 `ember-object://media/<hash>`。
 *    这是第 9 期起真实导入的媒体，存在对象仓里，随库搬走。
 * 2. **演示素材** → 一期用 ffmpeg+TTS 造的那两段，打包在产物里（顺手保留，
 *    这样演示数据不依赖用户先导入东西）。
 * 3. **都没有** → transcript-only，播放器退化成"文字时间轴"。
 *
 * 第 3 条在文明断层的设定里是常态而非异常：片子丢了、话还在。
 * 所以它不是错误状态，界面上要把它讲清楚，而不是显示"播放失败"。
 */

import type { Carrier } from '@shared/types/carrier'
import type { MediaSource } from '@shared/types/media'
import type { MediaService } from '@/services/media'
import { objectUrl } from '@/lib/objectUrl'

/** 演示素材路径（相对 index.html，dev 与打包后都能取到） */
const DEMO_MEDIA: Record<string, string> = {
  'c-video-fire': './media/fire-drilling.mp4',
  'c-audio-iron': './media/iron-oral-history.mp3'
}

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

      // 1. 真实入库的媒体：对象仓里的文件
      if (carrier.objectHash) {
        return {
          kind: 'local',
          src: objectUrl(carrier.objectHash),
          mediaType,
          note: '原片已存入火种库，可直接播放。'
        }
      }

      // 2. 演示素材
      const src = DEMO_MEDIA[carrier.id]
      if (src) {
        return {
          kind: 'local',
          src,
          mediaType,
          note: '原片已存入火种库，可直接播放。'
        }
      }

      // 3. 没有原片：只能靠转写文字
      return {
        kind: 'transcript-only',
        mediaType,
        note: '原片已遗失，但转写下来的文字还在——可以按文字时间轴阅读。'
      }
    }
  }
}
