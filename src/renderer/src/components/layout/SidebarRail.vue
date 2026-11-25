<script setup lang="ts">
/**
 * 窄图标侧边栏（SidebarRail）：
 * - 宽 52px，图标竖排，纯图标 + 悬停显示 title。
 * - 悬停整栏展开为文字标签（折中方案：既保留窄栏的紧凑，又让陌生词可读）。
 * - 颜色全部走 CSS 变量（--sidebar-rail-*）。
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  LibraryBig,
  Network,
  MessageSquareText,
  Settings,
  Wrench,
  Flame
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

// 悬停时展开文字标签
const expanded = ref(false)

interface NavItem {
  path: string
  label: string
  icon: typeof LayoutDashboard
}

// 一级导航项（顺序 = 页面上到下；设置单独放底部）
const navItems: NavItem[] = [
  { path: '/dashboard', label: '首页', icon: LayoutDashboard },
  { path: '/library', label: '图书馆', icon: LibraryBig },
  { path: '/tech-tree', label: '技术树', icon: Network },
  { path: '/chat', label: 'AI 对话', icon: MessageSquareText },
  { path: '/admin', label: '管理', icon: Wrench }
]

// 底部项（与主导航分离：设置是"低频全局"入口，惯例放左下角）
const footerItems: NavItem[] = [{ path: '/settings', label: '设置', icon: Settings }]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function go(path: string): void {
  router.push(path)
}
</script>

<template>
  <nav
    class="rail"
    :class="{ 'rail--expanded': expanded }"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <!-- 顶部品牌：火种图标（展示用，点击行为交给标题栏与导航） -->
    <div class="rail__brand" title="文明火种">
      <Flame :size="21" />
      <span v-if="expanded" class="rail__brand-text">文明火种</span>
    </div>

    <!-- 中部导航图标 -->
    <div class="rail__nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="rail__item"
        :class="{ 'rail__item--active': isActive(item.path) }"
        :title="expanded ? '' : item.label"
        @click="go(item.path)"
      >
        <component :is="item.icon" :size="21" />
        <span v-if="expanded" class="rail__label">{{ item.label }}</span>
      </button>
    </div>

    <!-- 底部：设置（惯例放左下角的低频全局入口） -->
    <div class="rail__footer">
      <button
        v-for="item in footerItems"
        :key="item.path"
        class="rail__item"
        :class="{ 'rail__item--active': isActive(item.path) }"
        :title="expanded ? '' : item.label"
        @click="go(item.path)"
      >
        <component :is="item.icon" :size="21" />
        <span v-if="expanded" class="rail__label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* 侧边栏窄栏：宽 52px，展开后变宽容纳文字 */
.rail {
  width: 52px;
  height: 100%;
  background: var(--sidebar-rail-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: width 0.18s ease;
  flex-shrink: 0;
  overflow: hidden;
}

.rail--expanded {
  width: 160px;
}

.rail__brand {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ember-500);
  flex-shrink: 0;
}

.rail__brand-text {
  font-weight: 700;
  color: var(--ember-400);
  white-space: nowrap;
}

.rail__nav {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
}

/* 每个图标位 44px，图标 21px，中间 30px 底板悬停高亮 */
.rail__item {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  border: none;
  color: var(--sidebar-rail-icon-color);
  cursor: pointer;
  border-radius: 8px;
  transition:
    background 0.15s,
    color 0.15s;
  position: relative;
}

.rail__item:hover {
  background: var(--sidebar-rail-hover-bg);
  color: var(--sidebar-rail-text-color);
}

.rail__item--active {
  color: var(--sidebar-rail-icon-active);
}

/* 展开态的文字标签 */
.rail__label {
  font-size: 13px;
  white-space: nowrap;
}

/* 底部区：与导航区同样式，但贴底固定 */
.rail__footer {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-bottom: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
</style>
