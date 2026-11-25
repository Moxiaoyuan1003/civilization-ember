/**
 * 媒体来源解析服务（MediaService）。
 *
 * 播放器需要先问一句"这个载体的片子/录音还在不在"，再决定怎么播。
 * 这一层单独抽出来，是因为它将来必然要依赖真实文件系统：
 * 现在由 Mock 回答，将来换成 Node 侧的实现（检查 data 目录里有没有这个文件、
 * 文件能不能解码），播放器组件一行都不用改。
 */

import type { Carrier } from '@/types/carrier'
import type { MediaSource } from '@/types/media'

/** 媒体来源解析：给一个音视频载体，回答"能不能播、怎么播、播不了怎么解释" */
export interface MediaService {
  /**
   * 解析播放源。
   * - 有可播文件 → local/remote，播放器用真实 <video>/<audio>
   * - 文件已丢失但转写还在 → transcript-only，播放器退化为"文字时间轴"
   */
  resolve(carrier: Carrier): Promise<MediaSource>
}
