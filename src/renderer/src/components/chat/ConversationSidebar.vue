<script setup lang="ts">
/**
 * 会话侧栏（ConversationSidebar）。
 *
 * 左侧列出全部历史会话（按更新时间倒序），支持：
 * - 点击切换会话
 * - 新建会话
 * - 删除会话（悬停显示删除按钮）
 *
 * 会话 = 个人数据（user_id 隔离），列表/增删都走 chat store。
 */

import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { MessageSquareText, Plus, Trash2 } from 'lucide-vue-next'
import { CHAT_MODES } from '@/types/chat'
import type { Conversation } from '@/types/chat'

const store = useChatStore()
const { conversations, activeConversationId } = storeToRefs(store)

/** 会话的模式中文名（侧栏标题旁的小标签） */
function modeName(conv: Conversation): string {
  return CHAT_MODES.find((m) => m.mode === conv.mode)?.name ?? conv.mode
}

/** 切换会话 */
function select(id: string): void {
  void store.selectConversation(id)
}

/** 删除会话（阻止冒泡，避免触发切换） */
function remove(e: MouseEvent, id: string): void {
  e.stopPropagation()
  void store.deleteConversation(id)
}
</script>

<template>
  <aside class="sidebar">
    <!-- 顶部：新建会话按钮 -->
    <div class="sidebar__head">
      <button class="sidebar__new" @click="store.newConversation()">
        <Plus :size="15" />
        <span>新建对话</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <div class="sidebar__list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="sidebar__item"
        :class="{ 'sidebar__item--active': conv.id === activeConversationId }"
        @click="select(conv.id)"
      >
        <MessageSquareText :size="15" class="sidebar__icon" />
        <div class="sidebar__body">
          <span class="sidebar__title">{{ conv.title }}</span>
          <span class="sidebar__mode">{{ modeName(conv) }}</span>
        </div>
        <button class="sidebar__del" title="删除会话" @click="remove($event, conv.id)">
          <Trash2 :size="14" />
        </button>
      </div>

      <!-- 空态 -->
      <p v-if="conversations.length === 0" class="sidebar__empty">还没有对话，点「新建对话」开始吧</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
}

.sidebar__head {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar__new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.sidebar__new:hover {
  background: var(--bg-surface-hover);
  border-color: var(--ember-500);
}

.sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
}

.sidebar__item:hover {
  background: var(--bg-surface-hover);
}

.sidebar__item--active {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.sidebar__icon {
  flex-shrink: 0;
  color: var(--ember-400);
}

.sidebar__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__mode {
  font-size: 11px;
  color: var(--text-muted);
}

.sidebar__del {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.12s;
}

.sidebar__item:hover .sidebar__del {
  opacity: 1;
}

.sidebar__del:hover {
  color: var(--danger);
  background: var(--bg-surface-hover);
}

.sidebar__empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 12px;
  margin: 0;
}
</style>
