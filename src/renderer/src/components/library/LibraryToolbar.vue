<script setup lang="ts">
/**
 * 图书馆顶栏（LibraryToolbar）。
 *
 * 承载图书馆页的顶部操作：
 * - 顶栏搜索框（命中标题/描述/作者，回车或点搜索进独立搜索页做全文+语义搜索）。
 * - 类型过滤（书/视频/音频/图片/网页）。
 * - 标签过滤（去重后的全部标签）。
 * - 排序（最近入库/标题/进度/大小）。
 * - 视图切换（卡片/列表，双模式，联动偏好）。
 * - 入库按钮（打开入库对话框）。
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import type { CarrierSort, CarrierType } from '@/types/carrier'
import { CARRIER_TYPES, carrierTypeMeta } from './carrierMeta'
import { Search, Upload, LayoutGrid, List } from 'lucide-vue-next'

const store = useLibraryStore()
const router = useRouter()
const { typeFilter, tagFilter, sort, view, allTags } = storeToRefs(store)

/** 排序选项 */
const SORT_OPTIONS: { value: CarrierSort; label: string }[] = [
  { value: 'recent', label: '最近入库' },
  { value: 'title', label: '标题' },
  { value: 'progress', label: '进度' },
  { value: 'size', label: '大小' }
]

/** 顶栏搜索框关键词（本地暂存，回车后进搜索页） */
const searchInput = ref('')

/** 进独立搜索页做全文+语义搜索 */
function goSearch(): void {
  const q = searchInput.value.trim()
  void router.push({ path: '/search', query: q ? { q } : {} })
}

/** 切换视图（卡片/列表） */
function toggleView(): void {
  void store.setView(view.value === 'card' ? 'list' : 'card')
}

/** 排序标签（当前选中） */
const sortLabel = computed(() => SORT_OPTIONS.find((s) => s.value === sort.value)?.label ?? '最近入库')
</script>

<template>
  <div class="lib-toolbar">
    <!-- 顶栏搜索框 -->
    <div class="lib-toolbar__search">
      <Search :size="14" class="lib-toolbar__search-icon" />
      <input
        v-model="searchInput"
        class="lib-toolbar__input"
        placeholder="搜索载体…（回车进入全文/语义搜索）"
        @keyup.enter="goSearch"
      />
      <button class="lib-toolbar__go" title="进入搜索页" @click="goSearch">
        <Search :size="14" />
      </button>
    </div>

    <!-- 类型过滤 -->
    <div class="lib-toolbar__chips">
      <button
        class="lib-toolbar__chip"
        :class="{ 'lib-toolbar__chip--active': typeFilter === null }"
        @click="store.setTypeFilter(null)"
      >
        全部
      </button>
      <button
        v-for="t in CARRIER_TYPES"
        :key="t"
        class="lib-toolbar__chip"
        :class="{ 'lib-toolbar__chip--active': typeFilter === t }"
        @click="store.setTypeFilter(t)"
      >
        <component :is="carrierTypeMeta(t).icon" :size="13" />
        {{ carrierTypeMeta(t).label }}
      </button>
    </div>

    <!-- 标签过滤 -->
    <select
      v-if="allTags.length"
      class="lib-toolbar__select"
      :value="tagFilter ?? ''"
      @change="store.setTagFilter(($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">全部标签</option>
      <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
    </select>

    <!-- 排序 -->
    <select
      class="lib-toolbar__select"
      :value="sort"
      @change="store.setSort(($event.target as HTMLSelectElement).value as CarrierSort)"
    >
      <option v-for="s in SORT_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
    </select>

    <!-- 视图切换 + 入库 -->
    <div class="lib-toolbar__spacer"></div>
    <button class="lib-toolbar__btn" :title="view === 'card' ? '切换到列表视图' : '切换到卡片视图'" @click="toggleView">
      <LayoutGrid v-if="view === 'card'" :size="15" />
      <List v-else :size="15" />
    </button>
    <button class="lib-toolbar__btn lib-toolbar__btn--primary" title="入库" @click="store.setImportOpen(true)">
      <Upload :size="15" />
      <span>入库</span>
    </button>
  </div>
</template>

<style scoped>
.lib-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
  flex-wrap: wrap;
}

.lib-toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  min-width: 240px;
}

.lib-toolbar__search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.lib-toolbar__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  min-width: 0;
}

.lib-toolbar__input::placeholder {
  color: var(--text-muted);
}

.lib-toolbar__go {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.lib-toolbar__go:hover {
  color: var(--text-primary);
}

.lib-toolbar__chips {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lib-toolbar__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.lib-toolbar__chip:hover {
  background: var(--bg-surface-hover);
}

.lib-toolbar__chip--active {
  background: var(--bg-elevated);
  border-color: var(--ember-500);
  color: var(--ember-400);
}

.lib-toolbar__select {
  height: 30px;
  padding: 0 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  outline: none;
}

.lib-toolbar__spacer {
  flex: 1;
}

.lib-toolbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.lib-toolbar__btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.lib-toolbar__btn--primary {
  border-color: var(--ember-500);
  color: var(--ember-400);
}
</style>
