<script setup lang="ts">
/**
 * 收藏卡（FavoritesCard）。
 *
 * 展示收藏/星标的载体（Feature Flag: features.favorites）。
 * 点击跳转载体详情页。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import DashboardCard from './DashboardCard.vue'
import { Star } from 'lucide-vue-next'

const store = useDashboardStore()
const router = useRouter()
const { favoriteCarriers, prefs } = storeToRefs(store)

const showFavorites = computed(() => prefs.value.features.favorites)

function open(id: string): void {
  void router.push(`/carrier/${id}`)
}
</script>

<template>
  <DashboardCard id="favorites" title="收藏" :icon="Star" action="去图书馆" @action="router.push('/library')">
    <div v-if="!showFavorites" class="fcard__off">
      <p class="fcard__empty">收藏功能已在设置中关闭。</p>
    </div>

    <div v-else-if="favoriteCarriers.length === 0" class="fcard__off">
      <p class="fcard__empty">还没有收藏，去图书馆点星标吧。</p>
    </div>

    <div v-else class="fcard">
      <div v-for="c in favoriteCarriers" :key="c.id" class="fcard__item" @click="open(c.id)">
        <span class="fcard__icon">
          <component :is="carrierTypeMeta(c.type).icon" :size="14" />
        </span>
        <span class="fcard__title">{{ c.title }}</span>
        <span class="fcard__type">{{ carrierTypeMeta(c.type).label }}</span>
      </div>
    </div>
  </DashboardCard>
</template>

<style scoped>
.fcard {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fcard__off {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

.fcard__empty {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.fcard__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.fcard__item:hover {
  background: var(--bg-surface-hover);
}

.fcard__icon {
  display: inline-flex;
  color: var(--ember-400);
  flex-shrink: 0;
}

.fcard__title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fcard__type {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
