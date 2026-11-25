<script setup lang="ts">
/**
 * 摄取进度卡（IngestCard）。
 *
 * 展示后台摄取队列的状态分布：待摄取 / 摄取中 / 已就绪 / 失败。
 * "查看队列"跳管理页（第 6 期实现，暂占位）。
 */

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import DashboardCard from './DashboardCard.vue'
import { Database } from 'lucide-vue-next'

const store = useDashboardStore()
const router = useRouter()
const { ingestStats, carriers } = storeToRefs(store)

function goAdmin(): void {
  void router.push('/admin')
}
</script>

<template>
  <DashboardCard id="ingest" title="摄取进度" :icon="Database" action="查看队列" @action="goAdmin">
    <div class="icard">
      <div class="icard__rows">
        <div v-for="s in ingestStats" :key="s.status" class="icard__row">
          <span class="icard__dot" :class="`icard__dot--${s.status}`"></span>
          <span class="icard__label">{{ s.label }}</span>
          <span class="icard__count">{{ s.count }}</span>
        </div>
      </div>
      <p class="icard__total">共 {{ carriers.length }} 个载体</p>
    </div>
  </DashboardCard>
</template>

<style scoped>
.icard {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.icard__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.icard__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.icard__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.icard__dot--pending {
  background: var(--text-muted);
}

.icard__dot--ingesting {
  background: var(--info);
}

.icard__dot--ready {
  background: var(--success);
}

.icard__dot--failed {
  background: var(--danger);
}

.icard__label {
  color: var(--text-secondary);
  flex: 1;
}

.icard__count {
  color: var(--text-primary);
  font-weight: 600;
}

.icard__total {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}
</style>
