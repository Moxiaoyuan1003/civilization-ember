/**
 * AI 对话页状态（Chat Store）。
 *
 * 职责：管理 AI 对话页所有"数据状态"与"业务动作"，与具体组件彻底解耦。
 * - 会话（conversations）= 个人数据（user_id 隔离）。
 * - 消息（messages）= 个人数据，挂在会话下。
 * - 三种预设模式（导航/断代问答/策展补漏）= 同一套 AI 能力 + 三套系统提示词。
 * - 出处（citations）：断代问答模式走真实检索（storage.searchCarriers），
 *   其余模式用预设引用，都能点击内嵌预览或跳转。
 *
 * 流式：发送后先 push 用户消息，AI 回答用 streamingText 逐段累加显示，
 * 结束后才作为一条完整的 assistant 消息落库。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import type { ChatMessage, Conversation, ChatMode, AiContext } from '@shared/types/chat'
import type { User, UserPreferences } from '@shared/types/user'
import type { Carrier, Citation } from '@shared/types/carrier'
import { DEFAULT_PREFERENCES } from '@shared/types/user'

/** 生成一个带前缀的本地唯一 id（Mock 阶段够用，真实后端会换 uuid） */
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useChatStore = defineStore('chat', () => {
  /* ---------- 数据状态 ---------- */

  /** 当前用户 */
  const user = ref<User | null>(null)
  /** 当前用户偏好（citationClick 决定出处点击行为） */
  const prefs = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
  /** 会话列表 */
  const conversations = ref<Conversation[]>([])
  /** 当前会话 id */
  const activeConversationId = ref<string | null>(null)
  /** 当前会话的消息 */
  const messages = ref<ChatMessage[]>([])
  /** 载体 id → 载体（出处预览显示标题用） */
  const carrierMap = ref<Map<string, Carrier>>(new Map())

  /* ---------- 对话交互状态 ---------- */

  /** 当前预设模式（会话级，切换会话时跟随该会话的 mode） */
  const mode = ref<ChatMode>('qa')
  /** 带入的上下文（从技术树/图书馆跳转而来） */
  const context = ref<AiContext | null>(null)
  /** 是否正在流式生成 */
  const streaming = ref(false)
  /** 正在流式累加的文本（AI 回答逐段显示） */
  const streamingText = ref('')
  /** 内嵌预览的出处（Citation | null，Feature: citationClick='preview'） */
  const previewCitation = ref<Citation | null>(null)

  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)

  /* ---------- 派生状态 ---------- */

  /** 当前会话对象 */
  const activeConversation = computed<Conversation | null>(() =>
    activeConversationId.value
      ? conversations.value.find((c) => c.id === activeConversationId.value) ?? null
      : null
  )

  /** 会话列表（按更新时间倒序，最新在上） */
  const sortedConversations = computed<Conversation[]>(() =>
    [...conversations.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  )

  /* ---------- 动作 ---------- */

  /** 加载对话页全部数据（用户 + 偏好 + 会话 + 载体） */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      const [u, list] = await Promise.all([
        services.storage.getOrCreateUser(),
        services.storage.listCarriers()
      ])
      user.value = u
      carrierMap.value = new Map(list.map((c) => [c.id, c]))

      prefs.value = await services.storage.getPreferences(u.id)
      conversations.value = await services.storage.listConversations(u.id)

      // 默认选中最新一条会话（有则载入其消息）
      if (conversations.value.length > 0) {
        const latest = [...conversations.value].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )[0]
        await selectConversation(latest.id)
      } else {
        await newConversation()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 切换会话：载入该会话的消息，并跟随其模式 */
  async function selectConversation(id: string): Promise<void> {
    const services = useServices()
    activeConversationId.value = id
    const conv = conversations.value.find((c) => c.id === id)
    if (conv) mode.value = conv.mode
    messages.value = await services.storage.listMessages(id)
    previewCitation.value = null
  }

  /** 新建会话（默认断代问答模式） */
  async function newConversation(): Promise<void> {
    if (!user.value) return
    const services = useServices()
    const now = new Date().toISOString()
    const conv: Conversation = {
      id: genId('conv'),
      title: '新的对话',
      mode: mode.value,
      userId: user.value.id,
      createdAt: now,
      updatedAt: now
    }
    await services.storage.createConversation(conv)
    conversations.value.push(conv)
    activeConversationId.value = conv.id
    messages.value = []
    previewCitation.value = null
  }

  /** 删除会话（连同消息） */
  async function deleteConversation(id: string): Promise<void> {
    if (!user.value) return
    const services = useServices()
    await services.storage.deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeConversationId.value === id) {
      // 删的是当前会话：切到最新一条，或新建
      if (conversations.value.length > 0) {
        await selectConversation(conversations.value[0].id)
      } else {
        await newConversation()
      }
    }
  }

  /** 切换预设模式 */
  function setMode(m: ChatMode): void {
    mode.value = m
  }

  /** 设置带入的上下文（从技术树/图书馆跳转而来） */
  function setContext(ctx: AiContext | null): void {
    context.value = ctx
  }

  /**
   * 把检索命中（SearchHit）转成出处（Citation）。
   * 断代问答模式：回答前先检索，把命中位置作为"回答带出处"。
   */
  function hitsToCitations(
    hits: { carrierId: string; location: string; snippet: string }[]
  ): Citation[] {
    return hits.map((h) => ({ carrierId: h.carrierId, location: h.location, note: h.snippet }))
  }

  /** 按模式构造回答的出处列表 */
  async function buildCitations(m: ChatMode, prompt: string): Promise<Citation[]> {
    const services = useServices()
    if (m === 'qa') {
      // 断代问答：真实检索（全文 + 语义）
      const hits = await services.storage.searchCarriers(prompt)
      return hitsToCitations(hits.slice(0, 3))
    }
    if (m === 'navigate') {
      // 导航模式：链路终点（蒸汽机）相关的引用载体
      return [
        { carrierId: 'c-book-steam', location: 'P1', note: '蒸汽机原理总论' },
        { carrierId: 'c-book-metallurgy', location: 'P88', note: '金属材料与连杆' }
      ]
    }
    // 策展补漏：缺口的关联载体
    return [
      { carrierId: 'c-audio-iron', location: '01:10', note: '鼓风与风箱口述' },
      { carrierId: 'c-web-charcoal', location: '§2', note: '燃料与高温来源' }
    ]
  }

  /** 发送一条消息（触发流式回答） */
  async function send(prompt: string): Promise<void> {
    if (!user.value || !activeConversationId.value) return
    if (streaming.value) return
    const services = useServices()
    const text = prompt.trim()
    if (!text) return

    // 1. 先落用户消息
    const userMsg: ChatMessage = {
      id: genId('m'),
      conversationId: activeConversationId.value,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }
    messages.value.push(userMsg)
    await services.storage.saveMessage(userMsg)

    // 首条消息更新会话标题（截取前 20 字）
    const conv = activeConversation.value
    if (conv && messages.value.filter((m) => m.role === 'user').length === 1) {
      conv.title = text.length > 20 ? text.slice(0, 20) + '…' : text
      await services.storage.createConversation({ ...conv })
      // 更新本地会话列表里的标题
      const idx = conversations.value.findIndex((c) => c.id === conv.id)
      if (idx >= 0) conversations.value[idx] = conv
    }

    // 2. 流式生成回答
    streaming.value = true
    streamingText.value = ''
    const history = messages.value.filter((m) => m.id !== userMsg.id) // 传历史（不含本条）
    const full = await services.ai.chat(mode.value, text, context.value ?? undefined, history, (delta) => {
      streamingText.value += delta
    })

    // 3. 构造出处并落 assistant 消息
    const citations = await buildCitations(mode.value, text)
    const assistantMsg: ChatMessage = {
      id: genId('m'),
      conversationId: activeConversationId.value,
      role: 'assistant',
      content: full,
      citations,
      createdAt: new Date().toISOString()
    }
    messages.value.push(assistantMsg)
    await services.storage.saveMessage(assistantMsg)

    streaming.value = false
    streamingText.value = ''
  }

  /** 打开出处内嵌预览（citationClick='preview' 时点击出处先弹预览） */
  function openPreview(citation: Citation): void {
    previewCitation.value = citation
  }

  /** 关闭出处内嵌预览 */
  function closePreview(): void {
    previewCitation.value = null
  }

  return {
    // 状态
    user,
    prefs,
    conversations,
    activeConversationId,
    messages,
    carrierMap,
    mode,
    context,
    streaming,
    streamingText,
    previewCitation,
    loading,
    error,
    // 派生
    activeConversation,
    sortedConversations,
    // 动作
    load,
    selectConversation,
    newConversation,
    deleteConversation,
    setMode,
    setContext,
    send,
    openPreview,
    closePreview
  }
})
