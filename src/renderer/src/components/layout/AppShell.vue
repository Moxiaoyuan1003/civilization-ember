<script setup lang="ts">
/**
 * 应用外壳：自绘标题栏 + 左侧窄图标侧边栏 + 右侧内容区。
 *
 * 结构（自上而下）：
 * - TitleBar（自绘标题栏，系统标题栏已隐藏，含窗口控制按钮）
 * - 下方水平区：左侧 SidebarRail（52px 窄图标竖排）+ 右侧 <router-view />
 * - 沉浸层页面（阅读器/播放器）通过路由 meta.fullscreen 判断：
 *   隐藏侧边栏，但保留标题栏（否则没有窗口控制按钮可点）。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SidebarRail from '@/components/layout/SidebarRail.vue'
import TitleBar from '@/components/layout/TitleBar.vue'

const route = useRoute()

// 沉浸层（阅读器/播放器）隐藏侧边栏，但标题栏保留（窗口控制仍需可用）
const isImmersive = computed(() => Boolean(route.meta.fullscreen))
</script>

<template>
  <div class="app-shell">
    <!-- 顶部自绘标题栏（全宽，窗口拖动区） -->
    <TitleBar />

    <!-- 下方主体：侧边栏 + 内容 -->
    <div class="app-shell__body">
      <!-- 左侧窄侧边栏（沉浸层隐藏） -->
      <SidebarRail v-if="!isImmersive" />

      <!-- 右侧内容区 -->
      <main class="relative flex-1 overflow-hidden">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-shell__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
