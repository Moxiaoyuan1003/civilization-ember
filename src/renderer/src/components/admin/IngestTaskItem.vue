<script setup lang="ts">
/**
 * 摄取任务行（IngestTaskItem）。
 *
 * 一条任务 = 一行卡片：载体标题 + 类型图标 + 状态徽标 + 阶段 + 进度条 + 操作按钮。
 *
 * 操作按钮按状态显示（这是"断点续传"在界面上的落点）：
 * - running  → 暂停
 * - paused   → 继续（从 checkpoint 之后接着跑）
 * - failed   → 重试
 * - pending  → 暂停（取消排队）
 * - done     → 只有"移出队列"
 */

import { computed } from 'vue'
import {
  BookOpen,
  Video,
  Headphones,
  Image,
  Globe,
  Play,
  Pause,
  RotateCw,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-vue-next'
import type { IngestTask, IngestStatus } from '@shared/types/ingest'
import { INGEST_STAGE_LABELS, INGEST_STATUS_LABELS } from '@shared/types/ingest'
import { formatPercent, formatRelativeTime } from '@/lib/format'
import { useAdminStore } from '@/stores/admin'

const props = defineProps<{ task: IngestTask }>()

const store = useAdminStore()

/** 类型图标 */
const typeIcon = computed(() => {
  switch (props.task.carrierType) {
    case 'book':
      return BookOpen
    case 'video':
      return Video
    case 'audio':
      return Headphones
    case 'image':
      return Image
    default:
      return Globe
  }
})

/** 状态徽标图标 */
const statusIcon = computed(() => {
  switch (props.task.status) {
    case 'running':
      return Loader2
    case 'done':
      return CheckCircle2
    case 'failed':
      return AlertCircle
    default:
      return Clock
  }
})

/** 该任务是否正在被操作（按钮禁用） */
const busy = computed(() => store.busyTaskId === props.task.id)

/** 进度条颜色随状态变化 */
const barColor = computed(() => {
  switch (props.task.status) {
    case 'done':
      return 'var(--success)'
    case 'failed':
      return 'var(--danger)'
    case 'paused':
      return 'var(--warning)'
    default:
      return 'var(--ember-500)'
  }
})

function onPause(): void {
  void store.pauseTask(props.task.id)
}
function onResume(): void {
  void store.resumeTask(props.task.id)
}
function onRetry(): void {
  void store.retryTask(props.task.id)
}
function onCancel(): void {
  void store.cancelTask(props.task.id)
}

/** 状态徽标的中文名 */
const statusLabel = computed(() => INGEST_STATUS_LABELS[props.task.status as IngestStatus])
</script>

<template>
  <div class="task" :class="`task--${task.status}`">
    <!-- 左：类型图标 -->
    <div class="task__icon">
      <component :is="typeIcon" :size="18" />
    </div>

    <!-- 中：标题 + 阶段 + 进度条 -->
    <div class="task__body">
      <div class="task__head">
        <span class="task__title" :title="task.carrierTitle">{{ task.carrierTitle }}</span>
        <span class="task__status" :class="`task__status--${task.status}`">
          <component :is="statusIcon" :size="12" :class="{ spin: task.status === 'running' }" />
          {{ statusLabel }}
        </span>
      </div>

      <div class="task__meta">
        <span class="task__stage">{{ INGEST_STAGE_LABELS[task.stage] }}</span>
        <span class="task__dot">·</span>
        <span>{{ formatPercent(task.progress) }}</span>
        <template v-if="task.checkpoint.length">
          <span class="task__dot">·</span>
          <span title="已完成并留档的阶段：中断后从这里续传">已存档 {{ task.checkpoint.length }} 阶段</span>
        </template>
        <template v-if="task.attempts > 1">
          <span class="task__dot">·</span>
          <span>第 {{ task.attempts }}/{{ task.maxAttempts }} 次尝试</span>
        </template>
        <span class="task__dot">·</span>
        <span>{{ formatRelativeTime(task.updatedAt) }}</span>
      </div>

      <!-- 进度条 -->
      <div class="task__bar">
        <div
          class="task__bar-fill"
          :class="{ 'task__bar-fill--pulse': task.status === 'running' }"
          :style="{ width: formatPercent(task.progress, 1), background: barColor }"
        />
      </div>

      <!-- 失败原因 -->
      <div v-if="task.lastError" class="task__error">
        <AlertCircle :size="12" />
        <span>{{ task.lastError }}</span>
      </div>
    </div>

    <!-- 右：操作按钮 -->
    <div class="task__actions">
      <button
        v-if="task.status === 'running' || task.status === 'pending'"
        class="task__btn"
        :disabled="busy"
        title="暂停（保留断点，可继续）"
        @click="onPause"
      >
        <Pause :size="14" />
      </button>

      <button
        v-if="task.status === 'paused'"
        class="task__btn task__btn--primary"
        :disabled="busy"
        title="继续（从断点续传）"
        @click="onResume"
      >
        <Play :size="14" />
      </button>

      <button
        v-if="task.status === 'failed' || task.status === 'paused'"
        class="task__btn"
        :disabled="busy"
        title="重试"
        @click="onRetry"
      >
        <RotateCw :size="14" />
      </button>

      <button
        class="task__btn task__btn--danger"
        :disabled="busy"
        :title="task.status === 'done' ? '移出队列' : '取消任务'"
        @click="onCancel"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.task {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.task:hover {
  border-color: var(--border-strong);
}

.task--failed {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border-color));
}

.task__icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.task__body {
  flex: 1;
  min-width: 0;
}

.task__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.task__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.task__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 20px;
  flex-shrink: 0;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.task__status--running {
  color: var(--ember-400);
}
.task__status--done {
  color: var(--success);
}
.task__status--failed {
  color: var(--danger);
}
.task__status--paused {
  color: var(--warning);
}

.task__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 7px;
  flex-wrap: wrap;
}

.task__stage {
  color: var(--text-secondary);
}

.task__dot {
  opacity: 0.5;
}

.task__bar {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.task__bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.task__bar-fill--pulse {
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.task__error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 7px;
  font-size: 11px;
  color: var(--danger);
  line-height: 1.5;
}

.task__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.task__btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.task__btn:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.task__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.task__btn--primary {
  color: var(--ember-400);
  border-color: color-mix(in srgb, var(--ember-500) 50%, transparent);
}

.task__btn--danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 50%, transparent);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
