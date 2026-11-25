<script setup lang="ts">
/**
 * 快捷入口卡（QuickCard）。
 *
 * 固定的一组导航快捷入口，方便从首页一键跳转。
 */

import { useRouter } from 'vue-router'
import DashboardCard from './DashboardCard.vue'
import {
  LayoutGrid,
  Library,
  Network,
  MessageCircle,
  Settings
} from 'lucide-vue-next'
import type { Component } from 'vue'

const router = useRouter()

interface QuickItem {
  label: string
  desc: string
  icon: Component
  path: string
}

const items: QuickItem[] = [
  { label: '图书馆', desc: '浏览全部载体', icon: Library, path: '/library' },
  { label: '技术树', desc: '查看文明路书', icon: Network, path: '/tech-tree' },
  { label: 'AI 对话', desc: '断代问答', icon: MessageCircle, path: '/chat' },
  { label: '管理', desc: '摄取与存储', icon: Settings, path: '/admin' }
]

function go(path: string): void {
  void router.push(path)
}
</script>

<template>
  <DashboardCard id="quick" title="快捷入口" :icon="LayoutGrid">
    <div class="qcard">
      <button v-for="it in items" :key="it.path" class="qcard__item" @click="go(it.path)">
        <span class="qcard__icon">
          <component :is="it.icon" :size="16" />
        </span>
        <span class="qcard__text">
          <span class="qcard__label">{{ it.label }}</span>
          <span class="qcard__desc">{{ it.desc }}</span>
        </span>
      </button>
    </div>
  </DashboardCard>
</template>

<style scoped>
.qcard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.qcard__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}

.qcard__item:hover {
  border-color: var(--ember-500);
  background: var(--bg-surface-hover);
}

.qcard__icon {
  display: inline-flex;
  color: var(--ember-400);
  flex-shrink: 0;
}

.qcard__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.qcard__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.qcard__desc {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
