<script setup lang="ts">
/**
 * 继续阅读卡（ContinueCard）。
 *
 * "接着上次读"：列出有阅读进度的载体（按更新时间倒序），
 * 附带"最近入库"载体（无进度时的兜底）。
 * 点击载体跳转阅读器/播放器。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import DashboardCard from './DashboardCard.vue'
import { BookOpen, Play } from 'lucide-vue-next'
import type { Carrier } from '@/types/carrier'

const store = useDashboardStore()
const router = useRouter()
const { continueReading, recentCarriers } = storeToRefs(store)

/** 有进度则显示"继续阅读"，否则显示"最近入库" */
const hasContinue = computed(() => continueReading.value.length > 0)

/** 目标路由：音视频 → 播放器，其余 → 阅读器 */
function targetPath(c: Carrier): string {
  return c.type === 'video' || c.type === 'audio'
    ? `/player/${c.id}`
    : `/reader/${c.id}`
}

function open(c: Carrier): void {
  void router.push(targetPath(c))
}
</script>

<template>
  <DashboardCard id="continue" title="继续阅读" :icon="BookOpen" action="全部载体" @action="router.push('/library')">
    <div v-if="hasContinue" class="ccard">
      <div
        v-for="item in continueReading"
        :key="item.carrier.id"
        class="ccard__item"
        @click="open(item.carrier)"
      >
        <span class="ccard__icon">
          <Play v-if="item.carrier.type === 'video' || item.carrier.type === 'audio'" :size="14" />
          <BookOpen v-else :size="14" />
        </span>
        <div class="ccard__info">
          <span class="ccard__title">{{ item.carrier.title }}</span>
          <span class="ccard__pos">{{ item.progress.position }} · {{ Math.round(item.progress.percent * 100) }}%</span>
        </div>
        <div class="ccard__bar">
          <div class="ccard__bar-fill" :style="{ width: `${item.progress.percent * 100}%` }"></div>
        </div>
      </div>
    </div>

    <!-- 无进度时的兜底：最近入库 -->
    <div v-else class="ccard">
      <p class="ccard__empty">暂无阅读进度，从最近入库开始吧。</p>
      <div v-for="c in recentCarriers" :key="c.id" class="ccard__item" @click="open(c)">
        <span class="ccard__icon">
          <component :is="carrierTypeMeta(c.type).icon" :size="14" />
        </span>
        <div class="ccard__info">
          <span class="ccard__title">{{ c.title }}</span>
          <span class="ccard__pos">{{ carrierTypeMeta(c.type).label }} · {{ c.authors?.[0] ?? '' }}</span>
        </div>
      </div>
    </div>
  </DashboardCard>
</template>

<style scoped>
.ccard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ccard__empty {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 4px;
}

.ccard__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}

.ccard__item:hover {
  background: var(--bg-surface-hover);
}

.ccard__icon {
  display: inline-flex;
  color: var(--ember-400);
  flex-shrink: 0;
}

.ccard__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.ccard__title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ccard__pos {
  font-size: 11px;
  color: var(--text-muted);
}

.ccard__bar {
  height: 3px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
  width: 60px;
  flex-shrink: 0;
}

.ccard__bar-fill {
  height: 100%;
  background: var(--ember-500);
}
</style>
