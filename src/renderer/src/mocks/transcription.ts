/**
 * Mock 转写服务。
 *
 * 直接从 mock 数据返回转写结果，模拟进度回调。
 * 后续接本地 Whisper / faster-whisper / FunASR 时替换此实现。
 */

import type { TranscriptionService } from '@/services/transcription'
import type { Transcript } from '@/types/carrier'
import { mockTranscripts } from '@/mocks/data'

export function createMockTranscription(): TranscriptionService {
  return {
    async transcribe(
      carrierId: string,
      onProgress?: (progress: number) => void
    ): Promise<Transcript> {
      // 模拟转写进度：0 → 1
      if (onProgress) {
        for (let p = 0; p <= 1; p += 0.25) {
          onProgress(p)
          await new Promise((resolve) => setTimeout(resolve, 30))
        }
      }
      const result = mockTranscripts.find((t) => t.carrierId === carrierId)
      if (!result) throw new Error(`无转写数据：${carrierId}`)
      return result
    }
  }
}
