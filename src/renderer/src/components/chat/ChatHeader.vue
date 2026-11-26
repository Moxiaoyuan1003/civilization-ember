<script setup lang="ts">
/**
 * 对话顶栏（ChatHeader）。
 *
 * 顶部显示：
 * - 当前会话标题
 * - 三种预设模式切换（导航 / 断代问答 / 策展补漏）
 *
 * 模式切换是会话级的（切换会更新当前会话 mode），下一轮回答按新模式走。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { CHAT_MODES } from '@shared/types/chat'
import type { ChatMode } from '@shared/types/chat'

const store = useChatStore()
const { mode, activeConversation } = storeToRefs(store)

/** 顶栏标题：会话标题或默认 */
const title = computed(() => activeConversation.value?.title ?? 'AI 对话')

/** 切换模式 */
function setMode(m: ChatMode): void {
  store.setMode(m)
}
</script>

<template>
  <header class="header">
    <h2 class="header__title">{{ title }}</h2>

    <!-- 模式切换 -->
    <div class="header__modes">
      <button
        v-for="m in CHAT_MODES"
        :key="m.mode"
        class="header__mode"
        :class="{ 'header__mode--active': m.mode === mode }"
        :title="m.desc"
        @click="setMode(m.mode)"
      >
        {{ m.name }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.header__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.header__modes {
  display: flex;
  gap: 4px;
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 3px;
}

.header__mode {
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.header__mode:hover {
  color: var(--text-primary);
}

.header__mode--active {
  background: var(--ember-600);
  color: #fff;
}
</style>
