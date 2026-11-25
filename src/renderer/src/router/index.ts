import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/**
 * 应用路由表。
 *
 * 说明：
 * - Electron 桌面应用用 hash 路由最稳（file:// 协议下 history 模式会有路径问题）。
 * - 7 个一级页面 + 2 个沉浸层，全部走同一套布局壳（AppShell）。
 * - 沉浸层（阅读器/播放器）后续做成全屏，这里先以独立路由占位。
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/pages/LibraryPage.vue'),
    meta: { title: '图书馆' }
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/pages/SearchPage.vue'),
    meta: { title: '搜索' }
  },
  {
    path: '/carrier/:id',
    name: 'carrier',
    component: () => import('@/pages/CarrierDetailPage.vue'),
    meta: { title: '载体详情' }
  },
  {
    path: '/tech-tree',
    name: 'tech-tree',
    component: () => import('@/pages/TechTreePage.vue'),
    meta: { title: '技术树' }
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/pages/ChatPage.vue'),
    meta: { title: 'AI 对话' }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/pages/AdminPage.vue'),
    meta: { title: '管理' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/reader/:id',
    name: 'reader',
    component: () => import('@/pages/ReaderPage.vue'),
    // fullscreen：沉浸层，AppShell 会隐藏左侧导航栏（保留自绘标题栏）
    meta: { title: '阅读器', fullscreen: true }
  },
  {
    path: '/player/:id',
    name: 'player',
    component: () => import('@/pages/PlayerPage.vue'),
    meta: { title: '播放器', fullscreen: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
