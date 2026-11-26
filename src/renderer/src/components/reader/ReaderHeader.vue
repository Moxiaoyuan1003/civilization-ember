<script setup lang="ts">
/**
 * 阅读器顶栏（ReaderHeader）。
 *
 * 沉浸层的操作中枢：返回、书名/章节、字号、阅读模式、书签、笔记面板。
 * 全部操作直接落到 reader store，组件本身不持有状态（只做展示与转发）。
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import type { ReadingMode } from '@shared/types/book'
import {
  ArrowLeft,
  Minus,
  Plus,
  Bookmark,
  BookmarkCheck,
  StickyNote,
  Columns2,
  ScrollText,
  List
} from 'lucide-vue-next'

const router = useRouter()
const store = useReaderStore()

const bookmarkOn = computed(() => Boolean(store.currentBookmark))

/** 返回来源页（优先浏览器历史，没有就回图书馆） */
function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/library')
}

/** 切换阅读模式 */
function setMode(m: ReadingMode): void {
  store.setMode(m)
}
</script>

<template>
  <header class="rhead">
    <!-- 左：返回 + 书名/章节 -->
    <div class="rhead__left">
      <button class="rhead__icon" title="返回" @click="goBack">
        <ArrowLeft :size="16" />
      </button>
      <div class="rhead__titles">
        <div class="rhead__title">{{ store.carrier?.title ?? '阅读器' }}</div>
        <div class="rhead__chapter">{{ store.chapter }}</div>
      </div>
    </div>

    <!-- 中：进度。没解析出正文时不显示"1 / 0"这种没有意义的数字 -->
    <div class="rhead__center">
      <span v-if="store.totalPages > 0" class="rhead__progress">
        {{ store.currentPage }} / {{ store.totalPages }}
      </span>
      <span v-else class="rhead__progress">—</span>
    </div>

    <!-- 右：字号 / 模式 / 书签 / 笔记 -->
    <div class="rhead__right">
      <div class="rhead__group" title="字号">
        <button class="rhead__icon" :disabled="store.fontSize <= 15" @click="store.smallerFont()">
          <Minus :size="15" />
        </button>
        <span class="rhead__fontsize">{{ store.fontSize }}</span>
        <button class="rhead__icon" :disabled="store.fontSize >= 22" @click="store.largerFont()">
          <Plus :size="15" />
        </button>
      </div>

      <div class="rhead__seg">
        <button
          class="rhead__segbtn"
          :class="{ 'rhead__segbtn--on': store.mode === 'page' }"
          title="翻页模式"
          @click="setMode('page')"
        >
          <Columns2 :size="14" />
          <span>翻页</span>
        </button>
        <button
          class="rhead__segbtn"
          :class="{ 'rhead__segbtn--on': store.mode === 'scroll' }"
          title="连续滚动"
          @click="setMode('scroll')"
        >
          <ScrollText :size="14" />
          <span>滚动</span>
        </button>
      </div>

      <button
        class="rhead__icon"
        :class="{ 'rhead__icon--on': bookmarkOn }"
        :title="bookmarkOn ? '取消本页书签' : '给本页加书签'"
        @click="store.toggleBookmark()"
      >
        <BookmarkCheck v-if="bookmarkOn" :size="16" />
        <Bookmark v-else :size="16" />
      </button>

      <button
        class="rhead__icon"
        :class="{ 'rhead__icon--on': store.panelOpen }"
        title="笔记与书签"
        @click="store.panelOpen = !store.panelOpen"
      >
        <StickyNote :size="16" />
      </button>

      <button
        class="rhead__icon"
        :class="{ 'rhead__icon--on': store.tocOpen }"
        title="目录"
        @click="store.tocOpen = !store.tocOpen"
      >
        <List :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.rhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 48px;
  padding: 0 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.rhead__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rhead__titles {
  min-width: 0;
}

.rhead__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rhead__chapter {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.rhead__center {
  flex-shrink: 0;
}

.rhead__progress {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.rhead__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.rhead__group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  height: 28px;
}

.rhead__fontsize {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.rhead__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.rhead__icon:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.rhead__icon:disabled {
  opacity: 0.35;
  cursor: default;
}

.rhead__icon--on {
  color: var(--ember-400);
  background: color-mix(in srgb, var(--ember-500) 14%, transparent);
}

.rhead__seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.rhead__segbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.rhead__segbtn:hover {
  color: var(--text-primary);
}

.rhead__segbtn--on {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}
</style>
