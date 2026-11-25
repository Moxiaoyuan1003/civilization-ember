<script setup lang="ts">
/**
 * 模块开关中心（ModulesPanel）—— 本软件的"Feature Flags 控制台"。
 *
 * 全局原则第 ② 条：核心功能常驻，"锦上添花"类增强功能做成独立可开关的模块。
 * 开关的语义（重要，别误解）：
 * - **关闭只是"界面上不出现"，数据一律不删。** 你关掉收藏，收藏记录还在，再打开就回来。
 * - 开关状态是**个人偏好**，每个用户/设备各记各的。
 *
 * 所以这里每个开关都配了两行字：它管什么 + 关了会怎样。
 */

import { computed } from 'vue'
import { Star, Highlighter, BookOpenCheck, Info, ToggleLeft } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import type { UserPreferences } from '@/types/user'

const store = useSettingsStore()

/** 模块开关的元信息（顺序即显示顺序） */
interface ModuleMeta {
  key: keyof UserPreferences['features']
  label: string
  icon: typeof Star
  /** 这个模块干什么 */
  what: string
  /** 关闭后的表现 */
  offEffect: string
  /** 是否为"核心功能"（核心不可关，这里只做展示说明） */
  core?: boolean
}

const MODULES: ModuleMeta[] = [
  {
    key: 'favorites',
    label: '收藏 / 星标',
    icon: Star,
    what: '在图书馆里给最核心的几十本打星标，首页有一张"收藏夹"卡片。',
    offEffect: '关闭后：卡片上的星标按钮消失、首页收藏卡不显示。已收藏的记录保留。'
  },
  {
    key: 'annotations',
    label: '标注 / 划线',
    icon: Highlighter,
    what: '阅读时划线、写批注，载体详情页会列出全部标注。',
    offEffect: '关闭后：阅读器不显示划线工具、详情页不显示标注区。已有标注保留。'
  },
  {
    key: 'readingProgress',
    label: '阅读进度',
    icon: BookOpenCheck,
    what: '记住每本书读到第几页、每个视频看到第几秒，首页"接着上次读"。',
    offEffect: '关闭后：不显示进度条与"接着上次读"卡片。进度记录保留。'
  }
]

/** 当前某个开关是否开启 */
function isOn(key: keyof UserPreferences['features']): boolean {
  return store.prefs.features[key]
}

/** 切换某个开关（立即生效并持久化） */
function toggle(key: keyof UserPreferences['features']): void {
  void store.toggleFeature(key)
}

/** 已开启数量（顶部小结） */
const onCount = computed(() => MODULES.filter((m) => isOn(m.key)).length)
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>模块开关中心</h2>
      <p>
        核心功能（图书馆检索、技术树、阅读器）永远在，不需要开关。
        这里管的是"增强功能"——你可以按自己的用法，决定哪些出现在界面上。
      </p>
    </div>

    <!-- 小结条 -->
    <div class="summary">
      <ToggleLeft :size="14" />
      <span>已开启 <strong>{{ onCount }}</strong> / {{ MODULES.length }} 个增强模块</span>
    </div>

    <!-- 模块列表 -->
    <div class="modules">
      <div v-for="m in MODULES" :key="m.key" class="module" :class="{ 'module--on': isOn(m.key) }">
        <div class="module__icon">
          <component :is="m.icon" :size="16" />
        </div>

        <div class="module__body">
          <div class="module__head">
            <span class="module__label">{{ m.label }}</span>
            <span class="module__state" :class="isOn(m.key) ? 'module__state--on' : ''">
              {{ isOn(m.key) ? '已开启' : '已关闭' }}
            </span>
          </div>
          <p class="module__what">{{ m.what }}</p>
          <p class="module__off">{{ m.offEffect }}</p>
        </div>

        <button
          class="toggle"
          :class="{ 'toggle--on': isOn(m.key) }"
          :title="isOn(m.key) ? '点击关闭' : '点击开启'"
          @click="toggle(m.key)"
        />
      </div>
    </div>

    <!-- 语义说明（重要） -->
    <div class="panel__note">
      <Info :size="13" />
      <span>
        <strong>关闭不等于删除。</strong>
        开关只控制"界面上出不出现"，所有数据都原样保留，随时可以再打开。
      </span>
    </div>

    <!-- 预留位 -->
    <div class="placeholder">
      <span>评分、分享、导出、标签云……同类功能都会接到这里，长成同一个样子。</span>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 14px;
  padding: 9px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  font-size: 12px;
  color: var(--text-secondary);
}

.summary strong {
  color: var(--ember-400);
}

.modules {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 11px;
  transition: border-color 0.15s;
}

.module--on {
  border-color: color-mix(in srgb, var(--ember-500) 32%, var(--border-color));
}

.module__icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.module--on .module__icon {
  color: var(--ember-400);
  background: color-mix(in srgb, var(--ember-500) 14%, transparent);
}

.module__body {
  flex: 1;
  min-width: 0;
}

.module__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.module__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.module__state {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.module__state--on {
  background: color-mix(in srgb, var(--ember-500) 18%, transparent);
  color: var(--ember-300);
}

.module__what {
  margin: 0 0 4px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.module__off {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
}

.placeholder {
  margin-top: 14px;
  padding: 16px;
  border: 1px dashed var(--border-color);
  border-radius: 11px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
