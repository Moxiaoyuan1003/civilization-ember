import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 主题状态：管理深色/浅色主题切换。
 *
 * 设计说明（对应全局原则）：
 * - 主题是"个人数据"，存本用户偏好，默认深色（贴合科幻调性）。
 * - 颜色全部走 CSS 变量（见 assets/main.css），切换只改 html 上的 data-theme，
 *   组件不感知具体色值，保证"换主题不动组件"。
 */
export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true)

  // 应用主题到 html 根节点
  function apply(): void {
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  }

  // 切换并持久化
  function toggle(): void {
    isDark.value = !isDark.value
    apply()
  }

  // 初始应用一次，并监听变化（持久化写入留到后续接本地存储时再补）
  apply()
  watch(isDark, apply)

  return { isDark, toggle, apply }
})
