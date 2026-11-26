/**
 * Mock 对话数据（示例会话：一段"断代问答"）。
 *
 * 验证 AI 对话页的会话列表、消息流、出处跳转。
 */

import type { Conversation, ChatMessage } from '@shared/types/chat'

/** Mock 会话列表 */
export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: '淬火为什么会让铁变硬？',
    mode: 'qa',
    userId: 'u-local',
    createdAt: '2026-02-03T09:00:00Z',
    updatedAt: '2026-02-03T09:02:00Z'
  },
  {
    id: 'conv-2',
    title: '我想从零造出蒸汽机，该走哪条路？',
    mode: 'navigate',
    userId: 'u-local',
    createdAt: '2026-02-03T10:00:00Z',
    updatedAt: '2026-02-03T10:05:00Z'
  }
]

/** Mock 消息（conv-1 断代问答两轮 + conv-2 导航模式两轮） */
export const mockMessages: ChatMessage[] = [
  {
    id: 'm1',
    conversationId: 'conv-1',
    role: 'user',
    content: '淬火为什么会让铁变硬？',
    createdAt: '2026-02-03T09:00:10Z'
  },
  {
    id: 'm2',
    conversationId: 'conv-1',
    role: 'assistant',
    content:
      '淬火让铁变硬，是因为烧红的铁快速冷却时，内部的晶格结构来不及缓慢重排，形成了更硬、更脆的马氏体组织。老铁匠口述里说"烧红的铁放进水里，表面会变硬"，指的就是这个现象。',
    citations: [
      { carrierId: 'c-audio-iron', location: '01:10', note: '老铁匠口述淬火' },
      { carrierId: 'c-book-metallurgy', location: 'P156', note: '淬火温度与冷却速度' }
    ],
    createdAt: '2026-02-03T09:02:00Z'
  },
  {
    id: 'm3',
    conversationId: 'conv-2',
    role: 'user',
    content: '我想从零造出蒸汽机，该走哪条路？',
    createdAt: '2026-02-03T10:00:10Z'
  },
  {
    id: 'm4',
    conversationId: 'conv-2',
    role: 'assistant',
    content:
      '从技术树看，通往蒸汽机的可行链路是：取火 → 木炭 → 冶铁 → 鼓风 → 机械传动 → 蒸汽机。缺两步就造不出来：一是鼓风（炉温上不去，铁水不成形），二是机械传动（没有把往复运动变成旋转的机构，蒸汽机只能抽水不能驱动机械）。建议先补"鼓风"这一环，它同时是冶铁和后续铸造的前置。',
    citations: [
      { carrierId: 'c-book-steam', location: 'P1', note: '蒸汽机原理总论' },
      { carrierId: 'c-book-metallurgy', location: 'P88', note: '金属材料与连杆' }
    ],
    createdAt: '2026-02-03T10:05:00Z'
  }
]
