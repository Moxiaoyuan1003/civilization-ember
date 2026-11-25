<script setup lang="ts">
/**
 * 目录侧栏（ReaderToc）。
 *
 * 显示章节列表 + 每章页数，当前章高亮；下方列本页已有的书签，可点击跳转。
 * 目录数据来自文档模型的 toc（真实实现由 EPUB 目录/PDF 大纲解析而来）。
 */

import { computed } from 'vue'
import { useReaderStore } from '@/stores/reader'
import { ChevronRight, Bookmark } from 'lucide-vue-next'

const store = useReaderStore()

/** 当前章节标题（用于目录高亮） */
const activeChapter = computed(() => store.chapter)
</script>

<template>
  <aside class="toc">
    <div class="toc__section">目录</div>
    <nav class="toc__list">
      <button
        v-for="item in store.doc?.toc ?? []"
        :key="item.title"
        class="toc__item"
        :class="{ 'toc__item--active': item.title === activeChapter }"
        @click="store.goChapter(item.title)"
      >
        <ChevronRight :size="13" class="toc__chev" />
        <span class="toc__title">{{ item.title }}</span>
        <span class="toc__pages">{{ item.pageCount }} 页</span>
      </button>
    </nav>

    <template v-if="store.bookmarks.length">
      <div class="toc__section toc__section--gap">书签</div>
      <nav class="toc__list">
        <button
          v-for="bm in store.bookmarks"
          :key="bm.id"
          class="toc__item toc__item--bm"
          :class="{ 'toc__item--active': bm.pageNo === store.currentPage }"
          @click="store.goPage(bm.pageNo)"
        >
          <Bookmark :size="12" class="toc__chev" />
          <span class="toc__title">第 {{ bm.pageNo }} 页</span>
          <span class="toc__pages">{{ bm.note ?? '' }}</span>
        </button>
      </nav>
    </template>
  </aside>
</template>

<style scoped>
.toc {
  width: 236px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-surface);
  overflow-y: auto;
  padding: 10px 8px 16px;
}

.toc__section {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 6px 8px;
  text-transform: uppercase;
}

.toc__section--gap {
  margin-top: 10px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.toc__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.toc__item {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: all 0.13s;
}

.toc__item:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.toc__item--active {
  background: color-mix(in srgb, var(--ember-500) 12%, transparent);
  color: var(--ember-300);
}

.toc__chev {
  flex-shrink: 0;
  opacity: 0.55;
}

.toc__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc__pages {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--text-muted);
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc__item--bm:deep(svg) {
  color: var(--ember-500);
  opacity: 1;
}
</style>
