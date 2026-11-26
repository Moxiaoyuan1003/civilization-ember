import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * 三个构建目标共用的路径别名。
 *
 * - `@`       ：前端源码根目录（只在渲染进程有意义）
 * - `@shared` ：主进程 / 预加载 / 渲染进程三方共用的层（领域类型、种子数据、存储契约）
 *
 * 第 8 期把存储层搬进主进程后，主进程也要引用 `@shared/types/*`，
 * 所以 main / preload 也必须认识这个别名。
 */
const sharedAlias = {
  '@shared': resolve('src/shared')
}

/**
 * electron-vite 统一配置：
 * - main   ：Electron 主进程（Node 环境）
 * - preload：预加载脚本（Node 环境，用 externalizeDepsPlugin 排除依赖）
 * - renderer：前端界面（浏览器环境，Vue + Tailwind）
 */
export default defineConfig({
  main: {
    resolve: {
      alias: sharedAlias
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: sharedAlias
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      // 用 @ 指向前端源码根目录，方便跨目录引用
      alias: {
        '@': resolve('src/renderer/src'),
        ...sharedAlias
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
