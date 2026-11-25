<script setup lang="ts">
/**
 * 应用根组件：只负责承载路由出口。
 * 布局（侧边栏 + 内容区）由 AppShell 统一提供。
 */
import AppShell from '@/components/layout/AppShell.vue'
</script>

<template>
  <AppShell />
</template>
