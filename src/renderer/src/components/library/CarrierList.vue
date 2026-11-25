<script setup lang="ts">
/**
 * 载体列表（CarrierList）。
 *
 * 按当前视图形态（卡片/列表）渲染载体集合，是图书馆页的主体。
 * 双模式：view === 'card' 用 CarrierCard，'list' 用 CarrierRow。
 */

import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import CarrierCard from './CarrierCard.vue'
import CarrierRow from './CarrierRow.vue'

const store = useLibraryStore()
const { carriers, view, loading, error } = storeToRefs(store)
</script>

<template>
  <div class="clist">
    <!-- 加载 / 错误 / 空态 -->
    <div v-if="loading" class="clist__state">正在加载载体…</div>
    <div v-else-if="error" class="clist__state clist__state--error">{{ error }}</div>
    <div v-else-if="carriers.length === 0" class="clist__state">没有匹配的载体，点击右上角「入库」添加。</div>

    <!-- 卡片视图 -->
    <div v-else-if="view === 'card'" class="clist__grid">
      <CarrierCard v-for="c in carriers" :key="c.id" :carrier="c" />
    </div>

    <!-- 列表视图 -->
    <div v-else class="clist__rows">
      <CarrierRow v-for="c in carriers" :key="c.id" :carrier="c" />
    </div>
  </div>
</template>

<style scoped>
.clist {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.clist__state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.clist__state--error {
  color: var(--danger);
}

.clist__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.clist__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
