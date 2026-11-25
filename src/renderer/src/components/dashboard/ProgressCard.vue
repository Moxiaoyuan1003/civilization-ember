<script setup lang="ts">
/**
 * 技术树进度卡（ProgressCard）。
 *
 * 展示：总节点数、已掌握数、掌握进度条、各层节点分布。
 * "查看技术树"跳转技术树页。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { layerOf } from '@/types/layer'
import DashboardCard from './DashboardCard.vue'
import { Network } from 'lucide-vue-next'

const store = useDashboardStore()
const router = useRouter()
const { totalNodes, masteredCount, progress, layerCounts } = storeToRefs(store)

const percent = computed(() => Math.round(progress.value * 100))

function goTree(): void {
  void router.push('/tech-tree')
}
</script>

<template>
  <DashboardCard id="progress" title="技术树进度" :icon="Network" action="查看技术树" @action="goTree">
    <div class="pcard">
      <div class="pcard__nums">
        <span class="pcard__num">{{ masteredCount }}</span>
        <span class="pcard__sep">/</span>
        <span class="pcard__num">{{ totalNodes }}</span>
        <span class="pcard__label">节点已掌握</span>
      </div>

      <div class="pcard__bar">
        <div class="pcard__bar-fill" :style="{ width: `${percent}%` }"></div>
      </div>
      <p class="pcard__pct">{{ percent }}% 重建进度</p>

      <!-- 各层分布 -->
      <div class="pcard__layers">
        <div v-for="l in layerCounts" :key="l.layer" class="pcard__layer">
          <span
            class="pcard__layer-dot"
            :style="{ background: `var(--layer-${l.layer})` }"
          ></span>
          <span class="pcard__layer-name">{{ l.name }}</span>
          <span class="pcard__layer-count">{{ l.count }}</span>
        </div>
      </div>
    </div>
  </DashboardCard>
</template>

<style scoped>
.pcard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pcard__nums {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.pcard__num {
  font-size: 22px;
  font-weight: 700;
  color: var(--ember-400);
}

.pcard__sep {
  color: var(--text-muted);
}

.pcard__label {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.pcard__bar {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.pcard__bar-fill {
  height: 100%;
  background: var(--ember-500);
  border-radius: 3px;
  transition: width 0.3s;
}

.pcard__pct {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}

.pcard__layers {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.pcard__layer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.pcard__layer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pcard__layer-name {
  color: var(--text-secondary);
  flex: 1;
}

.pcard__layer-count {
  color: var(--text-muted);
}
</style>
