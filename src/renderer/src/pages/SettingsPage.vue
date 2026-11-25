<script setup lang="ts">
/**
 * 设置页（SettingsPage）。
 *
 * 结构：左侧页签栏（六个分组）+ 右侧内容区（当前页签的面板）+ 底部保存条。
 *
 * 页签的分组逻辑（不是随便分的）：
 * - 前三个（AI / 转写 / 存储）是**整机设置**：这台机器怎么跑。
 * - 后三个（账号 / 界面偏好 / 模块开关）是**个人设置**：这个人怎么用。
 * 页签栏上用一条分隔线把这两组分开，让"改的是谁的东西"一眼可见。
 */

import { computed, onMounted } from 'vue'
import {
  Bot,
  AudioLines,
  HardDrive,
  UserRound,
  SlidersHorizontal,
  ToggleLeft,
  Loader2,
  Check,
  type LucideIcon
} from 'lucide-vue-next'
import { useSettingsStore, SETTINGS_TABS } from '@/stores/settings'
import type { SettingsTab } from '@/stores/settings'
import AiPanel from '@/components/settings/AiPanel.vue'
import TranscriptionPanel from '@/components/settings/TranscriptionPanel.vue'
import StorageSettingsPanel from '@/components/settings/StorageSettingsPanel.vue'
import AccountPanel from '@/components/settings/AccountPanel.vue'
import AppearancePanel from '@/components/settings/AppearancePanel.vue'
import ModulesPanel from '@/components/settings/ModulesPanel.vue'

const store = useSettingsStore()

/** 页签 id → 图标 */
const TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  ai: Bot,
  transcription: AudioLines,
  storage: HardDrive,
  account: UserRound,
  appearance: SlidersHorizontal,
  modules: ToggleLeft
}

/** 属于"个人设置"的页签（页签栏在它前面画分隔线） */
const PERSONAL_TABS: SettingsTab[] = ['account', 'appearance', 'modules']

/** 当前页签是否需要"保存"按钮（界面偏好和模块开关是即时生效，不需要） */
const needsSave = computed(
  () => store.activeTab === 'ai' || store.activeTab === 'transcription' || store.activeTab === 'storage'
)

/** 保存当前页签的设置 */
function onSave(): void {
  void store.saveAppSettings()
}

onMounted(() => {
  void store.load()
})
</script>

<template>
  <div class="settings">
    <!-- 左侧页签栏 -->
    <aside class="settings__nav">
      <div class="settings__nav-title">设置</div>

      <template v-for="tab in SETTINGS_TABS" :key="tab.id">
        <!-- 个人设置组前画分隔线 -->
        <div v-if="PERSONAL_TABS.includes(tab.id) && tab.id === PERSONAL_TABS[0]" class="settings__divider" />
        <button
          class="settings__tab"
          :class="{ 'settings__tab--active': store.activeTab === tab.id }"
          @click="store.setTab(tab.id)"
        >
          <component :is="TAB_ICONS[tab.id]" :size="15" />
          <span class="settings__tab-text">
            <span class="settings__tab-label">{{ tab.label }}</span>
            <span class="settings__tab-desc">{{ tab.desc }}</span>
          </span>
        </button>
      </template>
    </aside>

    <!-- 右侧内容 -->
    <section class="settings__content">
      <!-- 加载中 -->
      <div v-if="store.loading" class="settings__state">
        <Loader2 :size="20" class="spin" />
        <span>正在读取设置…</span>
      </div>

      <template v-else>
        <div class="settings__scroll">
          <AiPanel v-if="store.activeTab === 'ai'" />
          <TranscriptionPanel v-else-if="store.activeTab === 'transcription'" />
          <StorageSettingsPanel v-else-if="store.activeTab === 'storage'" />
          <AccountPanel v-else-if="store.activeTab === 'account'" />
          <AppearancePanel v-else-if="store.activeTab === 'appearance'" />
          <ModulesPanel v-else-if="store.activeTab === 'modules'" />
        </div>

        <!-- 底部保存条（只在需要保存的页签出现） -->
        <footer v-if="needsSave" class="settings__footer">
          <span v-if="store.dirty" class="settings__dirty">有未保存的改动</span>
          <span v-else-if="store.saveState === 'saved'" class="settings__saved">
            <Check :size="13" />
            已保存
          </span>
          <span v-else class="settings__hint">改完记得保存</span>

          <button class="btn btn--primary" :disabled="!store.dirty" @click="onSave">
            <Loader2 v-if="store.saveState === 'saving'" :size="13" class="spin" />
            <Check v-else :size="13" />
            保存设置
          </button>
        </footer>
      </template>
    </section>
  </div>
</template>

<style scoped>
.settings {
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* 左侧页签栏 */
.settings__nav {
  width: 208px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 18px 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings__nav-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  padding: 0 8px 12px;
}

.settings__tab {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  padding: 8px 9px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.settings__tab:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.settings__tab--active {
  background: color-mix(in srgb, var(--ember-500) 14%, transparent);
  color: var(--ember-300);
}

/* 图标与文字顶端对齐（两行文字时图标不居中偏移） */
.settings__tab > svg {
  margin-top: 2px;
  flex-shrink: 0;
}

.settings__tab-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.settings__tab-label {
  font-size: 12.5px;
  font-weight: 600;
}

.settings__tab-desc {
  font-size: 10.5px;
  color: var(--text-muted);
  line-height: 1.35;
}

.settings__divider {
  height: 1px;
  background: var(--border-color);
  margin: 10px 8px;
}

/* 右侧内容区 */
.settings__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.settings__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}

/* 底部保存条 */
.settings__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 28px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.settings__dirty {
  font-size: 12px;
  color: var(--warning);
}

.settings__saved {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--success);
}

.settings__hint {
  font-size: 12px;
  color: var(--text-muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .settings__nav {
    width: 64px;
    padding: 16px 6px;
  }
  .settings__nav-title,
  .settings__tab-text {
    display: none;
  }
  .settings__tab {
    justify-content: center;
    padding: 10px 0;
  }
}
</style>
