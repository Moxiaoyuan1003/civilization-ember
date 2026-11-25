<script setup lang="ts">
/**
 * 独立全屏搜索页（SearchPage）。
 *
 * 从图书馆顶栏搜索框进入，做全文 + 语义搜索，结果按"命中位置"列出。
 * 每条命中显示：载体标题 + 命中位置（书页/时间戳）+ 片段 + 来源（全文/语义），
 * 点击跳转到阅读器/播放器的对应位置。
 */

import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import { Search, ArrowLeft, BookOpen } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const { searchHits, searchQuery, searching, carrierMap } = storeToRefs(store)

const input = ref((route.query.q as string) ?? '')

onMounted(async () => {
  await store.load()
  if (input.value.trim()) await store.search(input.value)
})

/** 执行搜索 */
async function doSearch(): Promise<void> {
  const q = input.value.trim()
  if (!q) return
  await store.search(q)
  // 同步 URL，便于刷新恢复
  await router.replace({ path: '/search', query: { q } })
}

/** 跳转到命中载体的阅读/播放位置 */
function openHit(carrierId: string): void {
  const c = carrierMap.value.get(carrierId)
  if (!c) return
  const target = c.type === 'video' || c.type === 'audio' ? `/player/${carrierId}` : `/reader/${carrierId}`
  void router.push(target)
}

/** 返回图书馆 */
function goBack(): void {
  void router.push('/library')
}
</script>

<template>
  <div class="search-page">
    <!-- 顶栏 -->
    <div class="search-page__bar">
      <button class="search-page__back" title="返回图书馆" @click="goBack">
        <ArrowLeft :size="16" />
      </button>
      <div class="search-page__box">
        <Search :size="15" class="search-page__icon" />
        <input
          v-model="input"
          class="search-page__input"
          placeholder="全文 + 语义搜索：书页、视频时间戳、讲淬火的段落…"
          @keyup.enter="doSearch"
        />
        <button class="search-page__go" @click="doSearch">搜索</button>
      </div>
    </div>

    <!-- 结果 -->
    <div class="search-page__body">
      <div v-if="searching" class="search-page__state">正在检索…</div>

      <template v-else-if="searchQuery">
        <div class="search-page__summary">「{{ searchQuery }}」找到 {{ searchHits.length }} 条命中</div>

        <div v-if="searchHits.length === 0" class="search-page__state">没有找到相关内容</div>

        <ul v-else class="search-page__hits">
          <li v-for="(h, i) in searchHits" :key="i" class="hit" @click="openHit(h.carrierId)">
            <span class="hit__type">
              <component
                :is="carrierTypeMeta(carrierMap.get(h.carrierId)?.type ?? 'book').icon"
                :size="15"
              />
            </span>
            <div class="hit__main">
              <div class="hit__head">
                <span class="hit__title">{{ carrierMap.get(h.carrierId)?.title ?? h.carrierId }}</span>
                <span class="hit__loc">{{ h.location }}</span>
              </div>
              <p class="hit__snippet">{{ h.snippet }}</p>
            </div>
            <span class="hit__source" :class="`hit__source--${h.source}`">
              {{ h.source === 'fulltext' ? '全文' : '语义' }}
            </span>
          </li>
        </ul>
      </template>

      <div v-else class="search-page__state search-page__state--idle">
        <BookOpen :size="20" />
        <span>输入关键词，搜索火种库里的书页、视频片段与网页段落</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
}

.search-page__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.search-page__back {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.search-page__back:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.search-page__box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 9px;
}

.search-page__icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-page__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  min-width: 0;
}

.search-page__input::placeholder {
  color: var(--text-muted);
}

.search-page__go {
  height: 26px;
  padding: 0 12px;
  background: var(--ember-500);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.search-page__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.search-page__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
}

.search-page__summary {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.search-page__hits {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hit {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
}

.hit:hover {
  border-color: var(--border-strong);
  background: var(--bg-surface-hover);
}

.hit__type {
  color: var(--ember-400);
  flex-shrink: 0;
  display: inline-flex;
  margin-top: 2px;
}

.hit__main {
  flex: 1;
  min-width: 0;
}

.hit__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.hit__title {
  font-size: 14px;
  font-weight: 600;
}

.hit__loc {
  font-size: 12px;
  color: var(--ember-400);
  flex-shrink: 0;
}

.hit__snippet {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
}

.hit__source {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}

.hit__source--fulltext {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 15%, transparent);
}

.hit__source--semantic {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
}
</style>
