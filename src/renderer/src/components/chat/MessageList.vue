<script setup lang="ts">
/**
 * 消息流（MessageList）。
 *
 * 显示当前会话的消息气泡：
 * - 用户消息靠右，AI 消息靠左。
 * - AI 消息正文下方列出"出处"（citations），每条出处可点：
 *   - citationClick='preview'：先内嵌预览，再点内嵌卡片跳对应阅读器/播放器。
 *   - citationClick='jump'：直接跳转。
 * - 流式生成时，末尾显示一个"正在输入"气泡，逐段显示 streamingText。
 *
 * 自动滚动到底部（新消息/流式增量时）。
 */

import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import type { Citation } from '@/types/carrier'
import { User, Sparkles } from 'lucide-vue-next'

const store = useChatStore()
const router = useRouter()
const { messages, streaming, streamingText, prefs, carrierMap } = storeToRefs(store)

/** 消息列表容器（自动滚动用） */
const listRef = ref<HTMLElement | null>(null)

/** 滚动到底部 */
async function scrollToBottom(): Promise<void> {
  await nextTick()
  listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
}

// 新消息或流式增量时，自动滚到底部
watch(
  () => [messages.value.length, streamingText.value.length],
  () => void scrollToBottom()
)

/** 出处点击：根据偏好决定内嵌预览 or 直接跳转 */
function onCitationClick(citation: Citation): void {
  if (prefs.value.citationClick === 'jump') {
    goCarrier(citation)
  } else {
    // 默认 preview：先弹内嵌预览
    store.openPreview(citation)
  }
}

/** 跳转到对应载体的阅读器/播放器（按类型） */
function goCarrier(citation: Citation): void {
  const carrier = carrierMap.value.get(citation.carrierId)
  if (!carrier) return
  const isAV = carrier.type === 'video' || carrier.type === 'audio'
  void router.push({ path: isAV ? `/player/${citation.carrierId}` : `/reader/${citation.carrierId}` })
}

/** 载体的显示名（详情标签） */
function carrierTitle(id: string): string {
  return carrierMap.value.get(id)?.title ?? id
}

/** 载体的类型中文名 */
function carrierTypeLabel(id: string): string {
  const c = carrierMap.value.get(id)
  return c ? carrierTypeMeta(c.type).label : ''
}
</script>

<template>
  <div ref="listRef" class="messages">
    <!-- 消息气泡 -->
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="msg"
      :class="msg.role === 'user' ? 'msg--user' : 'msg--assistant'"
    >
      <div class="msg__avatar">
        <User v-if="msg.role === 'user'" :size="15" />
        <Sparkles v-else :size="15" />
      </div>
      <div class="msg__content">
        <p class="msg__text">{{ msg.content }}</p>

        <!-- 出处列表（仅 AI 消息） -->
        <div v-if="msg.role === 'assistant' && msg.citations?.length" class="msg__citations">
          <span class="msg__citations-label">出处</span>
          <button
            v-for="(c, i) in msg.citations"
            :key="i"
            class="msg__cite"
            @click="onCitationClick(c)"
          >
            <span class="msg__cite-type">{{ carrierTypeLabel(c.carrierId) }}</span>
            <span class="msg__cite-title">{{ carrierTitle(c.carrierId) }}</span>
            <span class="msg__cite-loc">{{ c.location }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 流式生成中的占位气泡 -->
    <div v-if="streaming" class="msg msg--assistant">
      <div class="msg__avatar">
        <Sparkles :size="15" />
      </div>
      <div class="msg__content">
        <p class="msg__text">{{ streamingText }}<span class="msg__cursor">▍</span></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.msg {
  display: flex;
  gap: 10px;
  max-width: 80%;
}

.msg--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg--assistant {
  align-self: flex-start;
}

.msg__avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  color: var(--ember-400);
  border: 1px solid var(--border-color);
}

.msg--user .msg__avatar {
  color: var(--text-secondary);
}

.msg__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.msg__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 14px;
}

.msg--user .msg__text {
  background: var(--ember-600);
  border-color: var(--ember-600);
  color: #fff;
}

.msg__cursor {
  color: var(--ember-400);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to {
    visibility: hidden;
  }
}

.msg__citations {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.msg__citations-label {
  font-size: 12px;
  color: var(--text-muted);
}

.msg__cite {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.msg__cite:hover {
  border-color: var(--ember-500);
  color: var(--ember-400);
}

.msg__cite-type {
  font-size: 11px;
  color: var(--text-muted);
}

.msg__cite-title {
  color: var(--text-primary);
}

.msg__cite-loc {
  color: var(--ember-400);
}
</style>
