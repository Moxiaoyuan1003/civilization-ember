<script setup lang="ts">
/**
 * 自绘标题栏（TitleBar）：
 * - 系统标题栏已隐藏（frame: false），此组件替代它：
 *   左侧显示应用名，右侧三个窗口控制按钮（最小化 / 最大化 / 关闭）。
 * - 整条栏可拖动窗口（-webkit-app-region: drag），按钮区排除拖动。
 * - 高度 40px，背景与侧边栏同色系，保持"原生桌面"紧凑感。
 */
import { Minus, Square, X, Flame } from 'lucide-vue-next'

/** 通过 preload 桥接层把窗口控制指令发给主进程 */
function control(action: 'minimize' | 'maximize-toggle' | 'close'): void {
  window.ember.windowControl(action)
}
</script>

<template>
  <header class="titlebar">
    <!-- 左侧：品牌名 -->
    <div class="titlebar__brand">
      <Flame :size="16" class="titlebar__flame" />
      <span class="titlebar__title">文明火种 · Civilization Ember</span>
    </div>

    <!-- 右侧：窗口控制三按钮（Windows 原生比例：46px 宽、全高） -->
    <div class="titlebar__controls">
      <button class="titlebar__btn" title="最小化" @click="control('minimize')">
        <Minus :size="16" />
      </button>
      <button class="titlebar__btn" title="最大化/还原" @click="control('maximize-toggle')">
        <Square :size="13" />
      </button>
      <button class="titlebar__btn titlebar__btn--close" title="关闭" @click="control('close')">
        <X :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--sidebar-rail-bg);
  border-bottom: 1px solid var(--border-color);
  /* 整条栏允许拖动窗口 */
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
}

.titlebar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 14px;
}

.titlebar__flame {
  color: var(--ember-500);
}

.titlebar__title {
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.titlebar__controls {
  display: flex;
  height: 100%;
  /* 按钮区不允许拖动，否则点不到 */
  -webkit-app-region: no-drag;
}

/* Windows 风格：按钮 46px 宽、撑满栏高，直角贴边 */
.titlebar__btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s;
}

.titlebar__btn:hover {
  background: var(--sidebar-rail-hover-bg);
  color: var(--text-primary);
}

/* 关闭按钮：悬停变红（Windows 惯例） */
.titlebar__btn--close:hover {
  background: #e81123;
  color: #ffffff;
}
</style>
