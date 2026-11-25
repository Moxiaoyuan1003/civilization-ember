import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * electron-vite 统一配置：
 * - main   ：Electron 主进程（Node 环境）
 * - preload：预加载脚本（Node 环境，用 externalizeDepsPlugin 排除依赖）
 * - renderer：前端界面（浏览器环境，Vue + Tailwind）
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      // 用 @ 指向前端源码根目录，方便跨目录引用
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
