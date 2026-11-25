/**
 * 管理页状态（Admin Store）。
 *
 * 职责：摄取任务队列 + 存储占用统计。
 * - 任务列表、状态分布（待处理/进行中/已暂停/已完成/失败）。
 * - 任务操作：暂停 / 继续（断点续传）/ 重试 / 取消。
 * - 存储统计：原文件 / 索引 / 去重节省 / 按类型明细。
 *
 * 所有逻辑走 services.ingest，真实实现换成 IPC 调摄取层进程时页面零改动。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import type { IngestTask, IngestStatus, StorageStats } from '@/types/ingest'

export const useAdminStore = defineStore('admin', () => {
  /* ---------- 状态 ---------- */

  /** 摄取任务列表 */
  const tasks = ref<IngestTask[]>([])
  /** 存储统计 */
  const stats = ref<StorageStats | null>(null)
  /** 状态过滤（null = 全部） */
  const statusFilter = ref<IngestStatus | null>(null)
  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 正在操作的任务 id（按钮禁用，防重复点击） */
  const busyTaskId = ref<string | null>(null)

  /* ---------- 派生 ---------- */

  /** 按状态过滤后的任务列表 */
  const filteredTasks = computed<IngestTask[]>(() => {
    const f = statusFilter.value
    return f ? tasks.value.filter((t) => t.status === f) : tasks.value
  })

  /** 各状态的任务计数（过滤栏徽标用） */
  const statusCounts = computed<Record<IngestStatus, number>>(() => {
    const counts: Record<IngestStatus, number> = {
      pending: 0,
      running: 0,
      paused: 0,
      done: 0,
      failed: 0
    }
    for (const t of tasks.value) counts[t.status] += 1
    return counts
  })

  /** 是否有任务正在运行（顶部提示"正在摄取"用） */
  const hasRunning = computed(() => statusCounts.value.running > 0)

  /* ---------- 动作 ---------- */

  /** 加载队列 + 存储统计 */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      const [list, s] = await Promise.all([
        services.ingest.listTasks(),
        services.ingest.getStorageStats()
      ])
      tasks.value = list
      stats.value = s
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 只刷新任务列表（操作后调用，比整页 load 轻） */
  async function refreshTasks(): Promise<void> {
    tasks.value = await useServices().ingest.listTasks()
  }

  /** 设置状态过滤 */
  function setStatusFilter(s: IngestStatus | null): void {
    statusFilter.value = s
  }

  /** 统一的任务操作包装：置忙 → 执行 → 刷新 → 解锁 */
  async function runTaskAction(id: string, action: () => Promise<void>): Promise<void> {
    if (busyTaskId.value) return
    busyTaskId.value = id
    try {
      await action()
      await refreshTasks()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      busyTaskId.value = null
    }
  }

  /** 暂停任务 */
  async function pauseTask(id: string): Promise<void> {
    await runTaskAction(id, () => useServices().ingest.pauseTask(id))
  }

  /** 继续任务（断点续传） */
  async function resumeTask(id: string): Promise<void> {
    await runTaskAction(id, () => useServices().ingest.resumeTask(id))
  }

  /** 重试失败任务 */
  async function retryTask(id: string): Promise<void> {
    await runTaskAction(id, () => useServices().ingest.retryTask(id))
  }

  /** 取消任务（从队列移除） */
  async function cancelTask(id: string): Promise<void> {
    await runTaskAction(id, () => useServices().ingest.cancelTask(id))
  }

  return {
    // 状态
    tasks,
    stats,
    statusFilter,
    loading,
    error,
    busyTaskId,
    // 派生
    filteredTasks,
    statusCounts,
    hasRunning,
    // 动作
    load,
    refreshTasks,
    setStatusFilter,
    pauseTask,
    resumeTask,
    retryTask,
    cancelTask
  }
})
