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
 *
 * 关于 `exclude`：chokidar 6 是纯 ESM 包，而主进程产物是 CJS。
 * 如果按默认策略"外部化"，产物里会变成 `require('chokidar')`，
 * 运行时直接报 `ERR_REQUIRE_ESM`（应用连窗口都开不出来，只在 stderr 留一行）。
 * 所以把它从外部化名单里排除，让 Vite 把它一起打成 CJS 内联进产物。
 */
export default defineConfig({
  main: {
    resolve: {
      alias: sharedAlias
    },
    plugins: [externalizeDepsPlugin({ exclude: ['chokidar'] })]
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
