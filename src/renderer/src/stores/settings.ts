/**
 * 设置页状态（Settings Store）。
 *
 * 两件事，刻意分开（对应数据模型的分层）：
 * 1. **整机设置（appSettings）**：AI 接线 / 转写引擎 / 存储目录——这台机器怎么跑。
 * 2. **个人偏好（prefs）**：主题 / 视图 / 模块开关 / 卡片布局——这个人怎么用。
 *
 * 界面上它们都在设置页，但落库位置不同：前者进配置文件，后者进 per-user 记录。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useServices } from '@/services'
import type { AppSettings } from '@/types/settings'
import { DEFAULT_APP_SETTINGS } from '@/types/settings'
import type { User, UserPreferences } from '@/types/user'
import { DEFAULT_PREFERENCES } from '@/types/user'
import { useThemeStore } from './theme'

/** 设置页的分组页签 id */
export type SettingsTab = 'ai' | 'transcription' | 'storage' | 'account' | 'appearance' | 'modules'

/** 页签元信息（顺序即显示顺序） */
export const SETTINGS_TABS: { id: SettingsTab; label: string; desc: string }[] = [
  { id: 'ai', label: 'AI 模型', desc: '对话用哪个大脑' },
  { id: 'transcription', label: '转写引擎', desc: '音视频如何变文字' },
  { id: 'storage', label: '存储与导入', desc: '数据放哪、监控哪个文件夹' },
  { id: 'account', label: '账号与设备', desc: '当前用户与个人数据' },
  { id: 'appearance', label: '界面偏好', desc: '主题、视图、点击行为' },
  { id: 'modules', label: '模块开关中心', desc: '决定哪些增强功能出现在界面上' }
]

export const useSettingsStore = defineStore('settings', () => {
  /* ---------- 状态 ---------- */

  /** 整机设置 */
  const appSettings = ref<AppSettings>(structuredClone(DEFAULT_APP_SETTINGS))
  /** 个人偏好 */
  const prefs = ref<UserPreferences>({ ...DEFAULT_PREFERENCES })
  /** 当前用户 */
  const user = ref<User | null>(null)
  /** 当前页签 */
  const activeTab = ref<SettingsTab>('ai')
  /** 加载中 / 错误 */
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 保存状态：null=无提示，'saving'=保存中，'saved'=刚保存成功 */
  const saveState = ref<'saving' | 'saved' | null>(null)
  /** 测试结果（AI 连通性 / 存储路径） */
  const testResult = ref<{ ok: boolean; message: string } | null>(null)
  /** 是否有未保存改动 */
  const dirty = ref(false)

  const themeStore = useThemeStore()

  /* ---------- 派生 ---------- */

  /** 当前用户显示名 */
  const userName = computed(() => user.value?.name ?? '未登录')

  /* ---------- 动作 ---------- */

  /** 加载设置页数据（整机设置 + 用户 + 偏好 + 主题同步） */
  async function load(): Promise<void> {
    const services = useServices()
    loading.value = true
    error.value = null
    try {
      const [s, u] = await Promise.all([services.settings.getSettings(), services.storage.getOrCreateUser()])
      appSettings.value = s
      user.value = u
      prefs.value = await services.storage.getPreferences(u.id)

      // 主题与偏好对齐（偏好是持久化的真相，theme store 是运行时呈现）
      themeStore.isDark = prefs.value.theme === 'dark'
      themeStore.apply()
      dirty.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 切换页签 */
  function setTab(tab: SettingsTab): void {
    activeTab.value = tab
    testResult.value = null
  }

  /** 标记有改动（表单输入时调用） */
  function markDirty(): void {
    dirty.value = true
    saveState.value = null
  }

  /** 保存整机设置 */
  async function saveAppSettings(): Promise<void> {
    const services = useServices()
    saveState.value = 'saving'
    try {
      await services.settings.saveSettings(appSettings.value)
      saveState.value = 'saved'
      dirty.value = false
      // 2 秒后清掉"已保存"提示
      setTimeout(() => {
        if (saveState.value === 'saved') saveState.value = null
      }, 2000)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      saveState.value = null
    }
  }

  /** 保存个人偏好（同时把主题同步到 theme store） */
  async function savePrefs(): Promise<void> {
    if (!user.value) return
    const services = useServices()
    saveState.value = 'saving'
    try {
      prefs.value.theme = themeStore.isDark ? 'dark' : 'light'
      await services.storage.savePreferences(prefs.value)
      saveState.value = 'saved'
      dirty.value = false
      setTimeout(() => {
        if (saveState.value === 'saved') saveState.value = null
      }, 2000)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      saveState.value = null
    }
  }

  /** 切换模块开关（立即生效并持久化——开关是"一眼看到变化"的操作，不要求点保存） */
  async function toggleFeature(key: keyof UserPreferences['features']): Promise<void> {
    prefs.value.features[key] = !prefs.value.features[key]
    await savePrefs()
  }

  /** 切换主题（立即生效并持久化） */
  async function setTheme(dark: boolean): Promise<void> {
    themeStore.isDark = dark
    themeStore.apply()
    await savePrefs()
  }

  /** 测试 AI 接线 */
  async function testAi(): Promise<void> {
    testResult.value = await useServices().settings.testAi()
  }

  /** 测试存储路径 */
  async function testStorage(path: string): Promise<void> {
    testResult.value = await useServices().settings.testStoragePath(path)
  }

  /** 清空测试结果提示 */
  function clearTestResult(): void {
    testResult.value = null
  }

  return {
    // 状态
    appSettings,
    prefs,
    user,
    activeTab,
    loading,
    error,
    saveState,
    testResult,
    dirty,
    // 派生
    userName,
    // 动作
    load,
    setTab,
    markDirty,
    saveAppSettings,
    savePrefs,
    toggleFeature,
    setTheme,
    testAi,
    testStorage,
    clearTestResult
  }
})
