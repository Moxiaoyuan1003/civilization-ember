<script setup lang="ts">
/**
 * 全局搜索框（GlobalSearchBar）。
 *
 * 首页顶栏的全局搜索：跨载体 / 技术树节点 / 对话会话。
 * 输入时下拉展示结果，点击跳转对应页面。
 */

import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore, type GlobalSearchResult } from '@/stores/dashboard'
import {
  Search,
  BookOpen,
  Network,
  MessageCircle,
  CornerDownLeft
} from 'lucide-vue-next'
import type { Component } from 'vue'

const store = useDashboardStore()
const router = useRouter()

const query = ref('')
const results = ref<GlobalSearchResult[]>([])
const open = ref(false)

/** 类型 → 图标映射 */
const KIND_ICON: Record<GlobalSearchResult['kind'], Component> = {
  carrier: BookOpen,
  node: Network,
  conversation: MessageCircle
}

/** 类型 → 中文名 */
const KIND_LABEL: Record<GlobalSearchResult['kind'], string> = {
  carrier: '载体',
  node: '技术节点',
  conversation: '对话'
}

let timer: ReturnType<typeof setTimeout> | undefined

watch(query, (q) => {
  clearTimeout(timer)
  const trimmed = q.trim()
  if (!trimmed) {
    results.value = []
    open.value = false
    return
  }
  timer = setTimeout(() => {
    void store.globalSearch(trimmed).then((r) => {
      results.value = r
      open.value = true
    })
  }, 200)
})

function choose(r: GlobalSearchResult): void {
  open.value = false
  query.value = ''
  results.value = []
  void router.push(r.path)
}

function blur(): void {
  // 延迟关闭，让点击先触发
  setTimeout(() => {
    open.value = false
  }, 150)
}
</script>

<template>
  <div class="gsearch">
    <div class="gsearch__box">
      <Search :size="15" class="gsearch__icon" />
      <input
        v-model="query"
        class="gsearch__input"
        placeholder="全局搜索：载体 / 技术节点 / 对话…"
        @focus="open = results.length > 0"
        @blur="blur"
      />
      <CornerDownLeft v-if="query" :size="13" class="gsearch__hint" />
    </div>

    <div v-if="open && results.length" class="gsearch__drop">
      <button
        v-for="r in results"
        :key="`${r.kind}-${r.title}`"
        class="gsearch__item"
        @mousedown.prevent="choose(r)"
      >
        <span class="gsearch__item-icon">
          <component :is="KIND_ICON[r.kind]" :size="14" />
        </span>
        <span class="gsearch__item-text">
          <span class="gsearch__item-title">{{ r.title }}</span>
          <span class="gsearch__item-sub">{{ r.subtitle }}</span>
        </span>
        <span class="gsearch__item-kind">{{ KIND_LABEL[r.kind] }}</span>
      </button>
    </div>
    <div v-else-if="open && query.trim()" class="gsearch__drop gsearch__drop--empty">
      <p class="gsearch__empty">没有匹配结果</p>
    </div>
  </div>
</template>

<style scoped>
.gsearch {
  position: relative;
  width: 100%;
  max-width: 480px;
}

.gsearch__box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 9px;
}

.gsearch__icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.gsearch__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  min-width: 0;
}

.gsearch__input::placeholder {
  color: var(--text-muted);
}

.gsearch__hint {
  color: var(--text-muted);
  flex-shrink: 0;
}

.gsearch__drop {
  position: absolute;
  top: 42px;
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 4px;
  z-index: 50;
  max-height: 320px;
  overflow-y: auto;
}

.gsearch__drop--empty {
  padding: 12px;
}

.gsearch__empty {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.gsearch__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
}

.gsearch__item:hover {
  background: var(--bg-surface-hover);
}

.gsearch__item-icon {
  display: inline-flex;
  color: var(--ember-400);
  flex-shrink: 0;
}

.gsearch__item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.gsearch__item-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gsearch__item-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gsearch__item-kind {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
