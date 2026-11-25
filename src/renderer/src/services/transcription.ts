/**
 * 转写服务接口（Transcription Service）。
 *
 * 视频/音频 → 带时间戳文本。可插拔换模型：
 * openai-whisper / faster-whisper / whisper.cpp / FunASR / SenseVoice 等。
 * 默认跑本地（吃显卡/时间），接口抽象让它随时可换。
 *
 * 注意：转写是【离线批处理】的一部分，由摄取层进程执行；
 * 这里只是渲染层查询/触发转写的入口。
 */

import type { Transcript } from '@/types/carrier'

export interface TranscriptionService {
  /**
   * 转写一个音视频载体。
   * @param carrierId 载体 id
   * @param onProgress 进度回调（0-1）
   * @returns 完整转写结果
   */
  transcribe(carrierId: string, onProgress?: (progress: number) => void): Promise<Transcript>
}
