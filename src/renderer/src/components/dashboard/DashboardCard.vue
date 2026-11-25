<script setup lang="ts">
/**
 * 首页卡片通用外壳（DashboardCard）。
 *
 * 统一卡片的视觉：标题栏（图标 + 标题 + 可选动作 + 隐藏按钮）+ 内容槽。
 * - 拖拽重排由父组件（DashboardPage）在卡片外层包裹上实现，这里只管"长相"。
 * - "隐藏"按钮调用 store.toggleCard(id)，落到个人偏好 dashboard.hiddenCards。
 */

import type { Component } from 'vue'
import { EyeOff } from 'lucide-vue-next'

const props = defineProps<{
  /** 卡片 id（用于隐藏） */
  id: string
  /** 标题 */
  title: string
  /** 标题图标 */
  icon: Component
  /** 右上角可选动作文案（如"查看全部"） */
  action?: string
  /** 是否显示隐藏按钮（默认显示） */
  hideable?: boolean
}>()

const emit = defineEmits<{ action: []; hide: [] }>()
</script>

<template>
  <section class="dcard">
    <header class="dcard__head">
      <span class="dcard__icon">
        <component :is="icon" :size="15" />
      </span>
      <h3 class="dcard__title">{{ title }}</h3>
      <button v-if="action" class="dcard__action" @click="emit('action')">{{ action }}</button>
      <button v-if="hideable !== false" class="dcard__hide" title="隐藏此卡片" @click="emit('hide')">
        <EyeOff :size="13" />
      </button>
    </header>
    <div class="dcard__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.dcard {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
}

.dcard__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.dcard__icon {
  display: inline-flex;
  color: var(--ember-400);
  flex-shrink: 0;
}

.dcard__title {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dcard__action {
  background: transparent;
  border: none;
  color: var(--ember-400);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.dcard__action:hover {
  background: var(--bg-surface-hover);
}

.dcard__hide {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: inline-flex;
  flex-shrink: 0;
}

.dcard__hide:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.dcard__body {
  padding: 12px 14px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
