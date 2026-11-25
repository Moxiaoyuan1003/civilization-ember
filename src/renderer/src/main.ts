import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initMockServices } from './mocks'
import './assets/main.css'
import './assets/panels.css'

/**
 * 应用入口：装配 Pinia（状态）、Vue Router（路由），挂载到 #app。
 * 未来接入更多插件（如 i18n、持久化）都从这里统一装配。
 */

// 注入服务容器（当前为 Mock 实现；后续换真实后端只改这一处）
initMockServices()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
