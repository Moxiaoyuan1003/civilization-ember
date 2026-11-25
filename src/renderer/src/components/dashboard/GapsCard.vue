<script setup lang="ts">
/**
 * 缺口统计卡（GapsCard）。
 *
 * 展示技术树的两类缺口：缺引用载体 / 缺前置节点。
 * 数据来自 lib/gaps.ts 的 detectGaps，与技术树页"缺口视图"同源。
 * "查看缺口"跳技术树页（默认缺口视图开启）。
 */

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import DashboardCard from './DashboardCard.vue'
import { AlertTriangle } from 'lucide-vue-next'

const store = useDashboardStore()
const router = useRouter()
const { gapCounts } = storeToRefs(store)

function goTree(): void {
  void router.push('/tech-tree')
}
</script>

<template>
  <DashboardCard id="gaps" title="缺口统计" :icon="AlertTriangle" action="查看缺口" @action="goTree">
    <div class="gcard">
      <div class="gcard__total">
        <span class="gcard__total-num">{{ gapCounts.total }}</span>
        <span class="gcard__total-label">处缺口待补</span>
      </div>

      <div class="gcard__rows">
        <div class="gcard__row">
          <span class="gcard__badge gcard__badge--citation">缺载体</span>
          <span class="gcard__desc">有知识点，但缺原书/视频支撑</span>
          <span class="gcard__count">{{ gapCounts.missingCitation }}</span>
        </div>
        <div class="gcard__row">
          <span class="gcard__badge gcard__badge--prereq">缺前置</span>
          <span class="gcard__desc">依赖的前置节点悬空</span>
          <span class="gcard__count">{{ gapCounts.missingPrereq }}</span>
        </div>
      </div>
    </div>
  </DashboardCard>
</template>

<style scoped>
.gcard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gcard__total {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.gcard__total-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--warning);
}

.gcard__total-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.gcard__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gcard__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.gcard__badge {
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  flex-shrink: 0;
}

.gcard__badge--citation {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.gcard__badge--prereq {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.gcard__desc {
  color: var(--text-secondary);
  flex: 1;
}

.gcard__count {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
