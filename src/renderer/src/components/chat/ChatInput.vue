<script setup lang="ts">
/**
 * 输入框（ChatInput）。
 *
 * 底部输入区：
 * - 多行文本输入框（Enter 发送，Shift+Enter 换行）。
 * - 发送按钮（流式生成中禁用，显示"生成中…"）。
 * - 带入的上下文提示（从技术树/图书馆跳转而来时显示，可清除）。
 *
 * 模式切换在顶栏（ChatHeader），不在这里。
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { Send, X, BookMarked } from 'lucide-vue-next'

const store = useChatStore()
const { streaming, context } = storeToRefs(store)

const draft = ref('')

/** 是否能发送（非流式 + 有内容） */
const canSend = computed(() => !streaming.value && draft.value.trim().length > 0)

/** 发送 */
function send(): void {
  if (!canSend.value) return
  const text = draft.value
  draft.value = ''
  void store.send(text)
}

/** 清除带入的上下文 */
function clearContext(): void {
  store.setContext(null)
}

/** 上下文摘要文案 */
const contextLabel = computed(() => {
  const c = context.value
  if (!c) return ''
  if (c.nodeId) return `已带入技术树节点 ${c.nodeId}${c.location ? '（' + c.location + '）' : ''}`
  if (c.carrierId) return `已带入载体 ${c.carrierId}${c.location ? '（' + c.location + '）' : ''}`
  return ''
})

/** 键盘：Enter 发送、Shift+Enter 换行 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="input">
    <!-- 带入上下文提示条 -->
    <div v-if="contextLabel" class="input__context">
      <BookMarked :size="13" />
      <span>{{ contextLabel }}</span>
      <button class="input__ctx-clear" title="清除上下文" @click="clearContext">
        <X :size="13" />
      </button>
    </div>

    <div class="input__row">
      <textarea
        v-model="draft"
        class="input__area"
        placeholder="向火种提问，例如：淬火为什么会让铁变硬？"
        rows="2"
        @keydown="onKeydown"
      ></textarea>
      <button class="input__send" :disabled="!canSend" @click="send">
        <Send :size="16" />
        <span>{{ streaming ? '生成中…' : '发送' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.input {
  border-top: 1px solid var(--border-color);
  background: var(--bg-surface);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input__context {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--ember-500);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--ember-400);
}

.input__ctx-clear {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.input__ctx-clear:hover {
  color: var(--text-primary);
}

.input__row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.input__area {
  flex: 1;
  resize: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  outline: none;
}

.input__area:focus {
  border-color: var(--ember-500);
}

.input__area::placeholder {
  color: var(--text-muted);
}

.input__send {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  background: var(--ember-600);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

.input__send:hover:not(:disabled) {
  background: var(--ember-500);
}

.input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
