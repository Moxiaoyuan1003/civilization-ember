<script setup lang="ts">
/**
 * AI 对话 Chat：问路者。
 *
 * 布局：左侧会话侧栏 + 右侧（顶栏 + 消息流 + 输入框）。
 * - 顶栏：会话标题 + 三模式切换。
 * - 消息流：用户/AI 气泡，AI 回答带出处，流式逐段显示。
 * - 输入框：多行 + 发送，显示带入的上下文。
 * - 出处内嵌预览：citationClick='preview' 时，点出处弹预览卡片。
 *
 * 挂载时 load()，读 route.query 里的 nodeId/carrierId/location 带入上下文
 * （从技术树/图书馆"问 AI"跳转而来）。
 */

import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import ConversationSidebar from '@/components/chat/ConversationSidebar.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import MessageList from '@/components/chat/MessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import CitationPreview from '@/components/chat/CitationPreview.vue'

const route = useRoute()
const store = useChatStore()

onMounted(() => {
  // 读跳转带来的上下文（技术树节点 / 图书馆载体）
  const ctx: { nodeId?: string; carrierId?: string; location?: string } = {}
  if (typeof route.query.nodeId === 'string') ctx.nodeId = route.query.nodeId
  if (typeof route.query.carrierId === 'string') ctx.carrierId = route.query.carrierId
  if (typeof route.query.location === 'string') ctx.location = route.query.location
  if (ctx.nodeId || ctx.carrierId) store.setContext(ctx)

  void store.load()
})

onUnmounted(() => {
  // 离开页面时清掉带入的上下文，避免残留到下次
  store.setContext(null)
})
</script>

<template>
  <div class="chat">
    <ConversationSidebar />

    <div class="chat__main">
      <ChatHeader />
      <div class="chat__body">
        <MessageList />
        <!-- 出处内嵌预览（浮动在消息流上方） -->
        <CitationPreview />
      </div>
      <ChatInput />
    </div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.chat__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
}

/* 预览卡片浮动在消息流底部 */
.chat__body :deep(.preview) {
  position: absolute;
  left: 20px;
  bottom: 12px;
  z-index: 20;
}
</style>
