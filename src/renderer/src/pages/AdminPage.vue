<script setup lang="ts">
/**
 * 管理页（AdminPage）：机房。
 *
 * 两块内容：
 * 1. **摄取队列**（左，主区）：任务卡片列表 + 状态过滤 + 断点续传操作。
 * 2. **存储占用**（右，侧栏 300px）：容量构成 + 按类型明细。
 *
 * 权限说明：本页入口在多用户场景下对普通用户隐藏（第 6 期先做单用户，
 * 权限判断留了 meta.requiresAdmin 的钩子，接账号系统时启用）。
 */

import { onMounted } from 'vue'
import { Loader2, RefreshCw, Inbox, AlertCircle } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/admin'
import type { IngestStatus } from '@/types/ingest'
import { INGEST_STATUS_LABELS } from '@/types/ingest'
import IngestTaskItem from '@/components/admin/IngestTaskItem.vue'
import StoragePanel from '@/components/admin/StoragePanel.vue'

const store = useAdminStore()

/** 状态过滤项（null = 全部） */
const FILTERS: { value: IngestStatus | null; label: string }[] = [
  { value: null, label: '全部' },
  { value: 'running', label: INGEST_STATUS_LABELS.running },
  { value: 'pending', label: INGEST_STATUS_LABELS.pending },
  { value: 'paused', label: INGEST_STATUS_LABELS.paused },
  { value: 'failed', label: INGEST_STATUS_LABELS.failed },
  { value: 'done', label: INGEST_STATUS_LABELS.done }
]

/** 某过滤项对应的任务数 */
function countFor(v: IngestStatus | null): number {
  if (v === null) return store.tasks.length
  return store.statusCounts[v]
}

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div class="admin">
    <!-- 页头 -->
    <header class="admin__header">
      <div class="admin__title-row">
        <div>
          <h1 class="admin__title">管理</h1>
          <p class="admin__desc">
            摄取队列与存储　·　离线把原始载体变成可检索的知识，中断了能从断点接着跑
          </p>
        </div>
        <button class="admin__refresh" :disabled="store.loading" @click="store.load()">
          <RefreshCw :size="14" :class="{ spin: store.loading }" />
          刷新
        </button>
      </div>

      <!-- 状态过滤条 -->
      <div class="admin__filters">
        <button
          v-for="f in FILTERS"
          :key="String(f.value)"
          class="admin__filter"
          :class="{ 'admin__filter--active': store.statusFilter === f.value }"
          @click="store.setStatusFilter(f.value)"
        >
          {{ f.label }}
          <span class="admin__filter-count">{{ countFor(f.value) }}</span>
        </button>
      </div>
    </header>

    <!-- 主体：左队列 + 右存储 -->
    <div class="admin__body">
      <section class="admin__main">
        <!-- 加载中 -->
        <div v-if="store.loading && !store.tasks.length" class="admin__state">
          <Loader2 :size="20" class="spin" />
          <span>正在读取队列…</span>
        </div>

        <!-- 错误 -->
        <div v-else-if="store.error" class="admin__state admin__state--error">
          <AlertCircle :size="20" />
          <span>{{ store.error }}</span>
        </div>

        <!-- 空态 -->
        <div v-else-if="!store.filteredTasks.length" class="admin__state">
          <Inbox :size="20" />
          <span>{{ store.statusFilter ? '这个状态下没有任务' : '队列是空的，去图书馆入库一些载体吧' }}</span>
        </div>

        <!-- 任务列表 -->
        <div v-else class="admin__tasks">
          <IngestTaskItem v-for="t in store.filteredTasks" :key="t.id" :task="t" />
        </div>
      </section>

      <!-- 右侧存储面板 -->
      <aside class="admin__aside">
        <StoragePanel :stats="store.stats" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.admin {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin__header {
  padding: 20px 24px 0;
  flex-shrink: 0;
}

.admin__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.admin__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--text-primary);
}

.admin__desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.admin__refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.admin__refresh:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.admin__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 过滤条 */
.admin__filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.admin__filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.admin__filter:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.admin__filter--active {
  background: color-mix(in srgb, var(--ember-500) 16%, transparent);
  border-color: color-mix(in srgb, var(--ember-500) 45%, transparent);
  color: var(--ember-300);
}

.admin__filter-count {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.admin__filter--active .admin__filter-count {
  background: color-mix(in srgb, var(--ember-500) 25%, transparent);
  color: var(--ember-300);
}

/* 主体布局 */
.admin__body {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 16px 24px 24px;
  overflow: hidden;
}

.admin__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.admin__aside {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
}

.admin__tasks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.admin__state--error {
  color: var(--danger);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 窄屏：存储面板移到下方 */
@media (max-width: 1100px) {
  .admin__body {
    flex-direction: column;
  }
  .admin__aside {
    width: 100%;
  }
}
</style>
