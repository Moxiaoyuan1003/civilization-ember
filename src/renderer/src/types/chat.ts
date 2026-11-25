/**
 * AI 对话（Chat）类型定义。
 *
 * AI 对话页是火种的"问路者"：用户在技术树/图书馆撞到看不懂的，来此问，
 * AI 从火种库找依据给出能落地的路，每条结论指回原书/原视频。
 */

import type { Citation } from './carrier'

/** AI 预设模式（= 同一套 AI 能力 + 三套系统提示词/流程，可切换） */
export type ChatMode = 'navigate' | 'qa' | 'curate'

/** 三种模式的元信息 */
export interface ChatModeMeta {
  /** 模式代码 */
  mode: ChatMode
  /** 中文名 */
  name: string
  /** 一句话说明 */
  desc: string
}

/** 三模式元信息表 */
export const CHAT_MODES: ChatModeMeta[] = [
  { mode: 'navigate', name: '导航', desc: '生成从零到目标节点的可行链路' },
  { mode: 'qa', name: '断代问答', desc: '检索载体、回答并给出处' },
  { mode: 'curate', name: '策展补漏', desc: '扫描技术树、报告缺口清单' }
]

/** 对话角色 */
export type ChatRole = 'user' | 'assistant'

/** 单条消息 */
export interface ChatMessage {
  /** 消息唯一 id */
  id: string
  /** 所属会话 id */
  conversationId: string
  /** 角色 */
  role: ChatRole
  /** 正文 */
  content: string
  /** 回答带的出处（assistant 消息才有） */
  citations?: Citation[]
  /** 创建时间（ISO 字符串） */
  createdAt: string
}

/** 会话 */
export interface Conversation {
  /** 会话唯一 id */
  id: string
  /** 标题（首条消息截取或手动命名） */
  title: string
  /** 使用的预设模式 */
  mode: ChatMode
  /** 用户 id（个人数据） */
  userId: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
  /** 更新时间（ISO 字符串） */
  updatedAt: string
}

/**
 * AI 请求上下文：从技术树/图书馆"问 AI"跳过来时带入的上下文。
 * 把"你正看哪个节点/载体、正在哪一页"一并交给 AI。
 */
export interface AiContext {
  /** 带入的技术树节点 id（可选） */
  nodeId?: string
  /** 带入的载体 id（可选） */
  carrierId?: string
  /** 当前浏览位置（书页/时间戳，可选） */
  location?: string
}
