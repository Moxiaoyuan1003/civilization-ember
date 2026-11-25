<script setup lang="ts">
/**
 * 界面偏好设置面板（AppearancePanel）。
 *
 * 这里集中了"个人怎么用这个软件"的选择，几乎每一项都是"双模式"的开关：
 * - 主题：深色 / 浅色
 * - 技术树配色：按层七色 / 统一琥珀
 * - 技术树详情：右侧固定栏 / 抽屉浮层
 * - 问 AI 方式：跳转对话页 / 页内浮窗
 * - 出处点击：内嵌预览优先 / 直接跳转
 * - 图书馆视图：卡片 / 列表
 *
 * 每一项都立即生效并写入个人偏好（per-user 落库）。
 */

import { computed } from 'vue'
import { Moon, Sun, Palette, PanelRight, MessageSquare, ExternalLink, LayoutGrid } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import SettingField from './SettingField.vue'

const store = useSettingsStore()

/** 偏好快捷引用 */
const p = computed(() => store.prefs)

/** 主题切换（立即生效 + 持久化） */
function setDark(dark: boolean): void {
  void store.setTheme(dark)
}

/** 改一项偏好并立即保存 */
async function pick<K extends 'techTreeColor' | 'techTreeDetail' | 'askAiMode' | 'citationClick' | 'libraryView'>(
  key: K,
  value: typeof p.value[K]
): Promise<void> {
  p.value[key] = value
  await store.savePrefs()
}
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>界面偏好</h2>
      <p>
        这里的每一项都有两种合理形态，没有"哪个对"——按你的习惯选。
        改动立即生效，并记在你这个用户（这台设备）名下。
      </p>
    </div>

    <div class="panel__body">
      <!-- 主题 -->
      <SettingField label="主题" hint="深色贴合科幻调性，浅色更适合白天久看">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': !store.prefs.theme || store.prefs.theme === 'dark' }"
            @click="setDark(true)"
          >
            <Moon :size="13" />
            深色
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': store.prefs.theme === 'light' }"
            @click="setDark(false)"
          >
            <Sun :size="13" />
            浅色
          </button>
        </div>
      </SettingField>

      <!-- 技术树配色 -->
      <SettingField label="技术树配色" hint="按层七色便于区分层级；统一琥珀系更沉、更贴合火种主题">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.techTreeColor === 'layer' }"
            @click="pick('techTreeColor', 'layer')"
          >
            <Palette :size="13" />
            按层七色
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.techTreeColor === 'ember' }"
            @click="pick('techTreeColor', 'ember')"
          >
            <Palette :size="13" />
            统一琥珀
          </button>
        </div>
      </SettingField>

      <!-- 技术树详情形态 -->
      <SettingField label="技术树节点详情" hint="固定栏适合长期开着查；抽屉在不看时完全不占地">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.techTreeDetail === 'side' }"
            @click="pick('techTreeDetail', 'side')"
          >
            <PanelRight :size="13" />
            右侧固定栏
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.techTreeDetail === 'drawer' }"
            @click="pick('techTreeDetail', 'drawer')"
          >
            <PanelRight :size="13" />
            抽屉浮层
          </button>
        </div>
      </SettingField>

      <!-- 问 AI 方式 -->
      <SettingField label="从这里问 AI" hint="跳转适合深聊；浮窗适合边看图边问一句">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.askAiMode === 'navigate' }"
            @click="pick('askAiMode', 'navigate')"
          >
            <MessageSquare :size="13" />
            跳转对话页
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.askAiMode === 'inline' }"
            @click="pick('askAiMode', 'inline')"
          >
            <MessageSquare :size="13" />
            页内浮窗
          </button>
        </div>
      </SettingField>

      <!-- 出处点击 -->
      <SettingField label="回答里的出处" hint="内嵌预览能先扫一眼原文；直接跳转更快进正文">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.citationClick === 'preview' }"
            @click="pick('citationClick', 'preview')"
          >
            <ExternalLink :size="13" />
            先内嵌预览
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.citationClick === 'jump' }"
            @click="pick('citationClick', 'jump')"
          >
            <ExternalLink :size="13" />
            直接跳转
          </button>
        </div>
      </SettingField>

      <!-- 图书馆视图 -->
      <SettingField label="图书馆默认视图" hint="卡片有封面更直观；列表一屏能看更多">
        <div class="segmented">
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.libraryView === 'card' }"
            @click="pick('libraryView', 'card')"
          >
            <LayoutGrid :size="13" />
            卡片
          </button>
          <button
            class="segmented__btn"
            :class="{ 'segmented__btn--active': p.libraryView === 'list' }"
            @click="pick('libraryView', 'list')"
          >
            <LayoutGrid :size="13" />
            列表
          </button>
        </div>
      </SettingField>
    </div>
  </div>
</template>

<style scoped>
/* 分段控件（双模式选择的统一长相） */
.segmented {
  display: inline-flex;
  padding: 3px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  gap: 2px;
}

.segmented__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.segmented__btn:hover {
  color: var(--text-primary);
}

.segmented__btn--active {
  background: color-mix(in srgb, var(--ember-500) 18%, transparent);
  color: var(--ember-300);
}
</style>
