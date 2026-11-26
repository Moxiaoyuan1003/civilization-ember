import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initServices } from './mocks'
import './assets/main.css'
import './assets/panels.css'

/**
 * 应用入口：装配 Pinia（状态）、Vue Router（路由），挂载到 #app。
 * 未来接入更多插件（如 i18n、持久化）都从这里统一装配。
 */

// 注入服务容器（存储层走主进程 SQLite；其余仍为 Mock，逐期替换）
initServices()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
