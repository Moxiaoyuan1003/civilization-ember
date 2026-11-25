<script setup lang="ts">
/**
 * 图书馆 Library：载体库（第 3 期实现）。
 *
 * 页面结构（自上而下）：
 * - 顶栏：搜索框（进独立搜索页）+ 类型过滤 + 标签过滤 + 排序 + 视图切换 + 入库。
 * - 主体：载体列表（卡片/列表双视图）+ 右侧详情面板（选中时显示）。
 * - 入库对话框（顶栏入库按钮触发）。
 *
 * 职责边界：本页只"组装"，数据在 store，交互在组件。
 * 从技术树页跳转过来时带 ?carrierId=，自动选中该载体。
 */

import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import LibraryToolbar from '@/components/library/LibraryToolbar.vue'
import CarrierList from '@/components/library/CarrierList.vue'
import CarrierDetailPanel from '@/components/library/CarrierDetailPanel.vue'
import ImportDialog from '@/components/library/ImportDialog.vue'

const store = useLibraryStore()
const route = useRoute()
const { selectedCarrier } = storeToRefs(store)

onMounted(async () => {
  await store.load()
  // 从技术树页跳转：自动选中指定载体
  const carrierId = route.query.carrierId as string | undefined
  if (carrierId) store.selectCarrier(carrierId)
})

// 响应路由参数变化（同页内再次跳转）
watch(
  () => route.query.carrierId,
  (id) => {
    if (typeof id === 'string') store.selectCarrier(id)
  }
)
</script>

<template>
  <div class="library">
    <!-- 顶栏 -->
    <LibraryToolbar />

    <!-- 主体：列表 + 详情面板 -->
    <div class="library__body">
      <CarrierList />
      <CarrierDetailPanel v-if="selectedCarrier" :carrier="selectedCarrier" />
    </div>

    <!-- 入库对话框 -->
    <ImportDialog />
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
}

.library__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
