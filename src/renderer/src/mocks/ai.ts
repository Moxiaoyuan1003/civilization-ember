/**
 * Mock AI 服务。
 *
 * 用预设模板模拟三种模式的回答，并流式逐段返回（模拟"一个字一个字蹦"）。
 * 后续接真实模型（云端 API → 本地 Ollama）时替换此实现。
 */

import type { AiService, StreamCallback } from '@/services/ai'
import type { AiContext, ChatMode, ChatMessage } from '@/types/chat'

/** 延迟一小段再逐段返回，模拟真实流式节奏 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 按模式返回预设回答 */
function answerFor(mode: ChatMode, prompt: string, context?: AiContext): string {
  const ctxNote = context?.nodeId
    ? `（你正在看节点 ${context.nodeId}${context.location ? '，位置 ' + context.location : ''}）`
    : ''
  switch (mode) {
    case 'navigate':
      return `这是从零到目标的可行链路${ctxNote}：\n` +
        `1. 取火（L0）——先掌握生火\n` +
        `2. 木炭烧制（L0）——获得高温燃料\n` +
        `3. 冶铁（L1）——炼出铁材\n` +
        `4. 机械传动（L2）——造出连杆曲柄\n` +
        `5. 蒸汽机（L3）——组装成机\n\n` +
        `缺口提示：冶铁依赖鼓风，当前鼓风节点缺引用载体。`
    case 'curate':
      return `已扫描技术树，发现以下缺口：\n` +
        `1. 节点「鼓风」缺引用载体（missing-citation）\n` +
        `2. 节点「淬火」缺前置节点「冶铁」的引用（missing-prerequisite）\n\n` +
        `建议补一本《风箱与鼓风装置》或相关视频。`
    case 'qa':
    default:
      return `关于「${prompt}」，据火种库检索：${ctxNote}\n` +
        `淬火让铁变硬，是因为烧红的铁快速冷却时内部形成更硬的马氏体组织。` +
        `详见《冶金原理》P156 与《冶铁工艺口述史》01:10。`
  }
}

export function createMockAi(): AiService {
  return {
    async chat(
      mode: ChatMode,
      prompt: string,
      context?: AiContext,
      history?: ChatMessage[],
      onDelta?: StreamCallback
    ): Promise<string> {
      // 本 Mock 暂不消费 history，仅保留参数占位（真实实现会用它做多轮）
      void history
      const full = answerFor(mode, prompt, context)

      // 流式：按小块逐段推送
      if (onDelta) {
        const chunkSize = 4
        for (let i = 0; i < full.length; i += chunkSize) {
          onDelta(full.slice(i, i + chunkSize))
          await delay(12)
        }
      }
      return full
    }
  }
}
