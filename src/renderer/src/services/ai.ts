/**
 * AI 服务接口（AI Service）。
 *
 * 这是"AI 可拔插、核心功能脱离 AI 独立成立"的落点：
 * - 先用云端 API 跑通逻辑，以后再换本地模型（Ollama 等）。
 * - 三种预设模式（导航/断代问答/策展补漏）本质是同一套能力 + 三套系统提示词。
 * - 核心功能（检索、看原书、查技术树）不经过这里，AI 只是增强层。
 */

import type { AiContext, ChatMode, ChatMessage } from '@/types/chat'

/**
 * AI 服务的流式回调：一次回答分多段推给 UI，实现"一个字一个字往外蹦"。
 * @param delta 本次增量文本
 */
export type StreamCallback = (delta: string) => void

export interface AiService {
  /**
   * 发起一次 AI 问答（流式）。
   *
   * @param mode 预设模式（导航/断代问答/策展补漏）
   * @param prompt 用户输入
   * @param context 带入的上下文（从技术树/图书馆跳转而来，可选）
   * @param history 本轮之前的对话历史（用于多轮）
   * @param onDelta 流式增量回调
   * @returns 完整回答文本
   */
  chat(
    mode: ChatMode,
    prompt: string,
    context?: AiContext,
    history?: ChatMessage[],
    onDelta?: StreamCallback
  ): Promise<string>
}
