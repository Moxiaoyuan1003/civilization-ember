<script setup lang="ts">
/**
 * AI 模型设置面板（AiPanel）。
 *
 * 三条线（对应"AI 可拔插、核心功能脱离 AI 独立成立"）：
 * 1. 提供方：本地假实现 / 云端 API / 本地模型——三选一，随时切换。
 * 2. 接线参数：基址 + 模型名 + 温度（兼容 OpenAI 协议的服务都这么填）。
 * 3. 连通性测试：一个按钮验证"通不通"，失败给出原因。
 *
 * 重要提示（写在界面上，不藏着）：即使 AI 完全不可用，
 * 图书馆检索、技术树浏览、阅读器这些核心功能照常可用——AI 只是增强。
 */

import { computed } from 'vue'
import { Check, Loader2, AlertCircle, KeyRound, Info } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { AI_PROVIDERS } from '@shared/types/settings'
import SettingField from './SettingField.vue'

const store = useSettingsStore()

/** AI 设置的快捷引用 */
const ai = computed(() => store.appSettings.ai)

/** 当前提供方的说明文字 */
const providerDesc = computed(
  () => AI_PROVIDERS.find((p) => p.value === ai.value.provider)?.desc ?? ''
)

/** 是否显示云端/本地的接线参数（mock 不需要） */
const showConnection = computed(() => ai.value.provider !== 'mock')

/** 输入变化 → 标记待保存 */
function onChange(): void {
  store.markDirty()
}

/** 测试连通性 */
function onTest(): void {
  void store.testAi()
}

/** 测试结果图标 */
const testIcon = computed(() => (store.testResult?.ok ? Check : AlertCircle))
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>AI 模型</h2>
      <p>
        决定"断代问答、生成链路、策展补漏"这三件事用哪个大脑。
        对话是增强能力，不接它也能正常检索与浏览。
      </p>
    </div>

    <div class="panel__body">
      <!-- 提供方 -->
      <SettingField label="提供方" hint="先用云端跑通逻辑，之后可随时换成本地模型">
        <select v-model="ai.provider" class="ctl ctl--select" @change="onChange">
          <option v-for="p in AI_PROVIDERS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </SettingField>

      <div class="panel__note">
        <Info :size="13" />
        <span>{{ providerDesc }}</span>
      </div>

      <!-- 接线参数 -->
      <template v-if="showConnection">
        <SettingField label="API 基址" hint="兼容 OpenAI 协议的服务地址，如 https://api.deepseek.com">
          <input v-model="ai.baseUrl" class="ctl ctl--input" type="text" @input="onChange" />
        </SettingField>

        <SettingField label="模型名" hint="如 deepseek-chat、qwen2.5:14b">
          <input v-model="ai.model" class="ctl ctl--input" type="text" @input="onChange" />
        </SettingField>

        <SettingField label="API Key" :hint="'真实版本会存进系统密钥库，不落明文配置。当前仅作本地演示'">
          <div class="key-wrap">
            <KeyRound :size="13" />
            <input
              v-model="ai.apiKey"
              class="ctl ctl--input key-wrap__input"
              type="password"
              placeholder="sk-..."
              @input="onChange"
            />
          </div>
        </SettingField>
      </template>

      <!-- 温度 -->
      <SettingField label="温度" hint="越低回答越稳、越高越发散。技术问答建议 0.3–0.7">
        <div class="slider-wrap">
          <input
            v-model.number="ai.temperature"
            class="slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            @input="onChange"
          />
          <span class="slider__value">{{ ai.temperature.toFixed(2) }}</span>
        </div>
      </SettingField>

      <!-- 测试 -->
      <SettingField label="连通性测试" hint="发一个最小请求，确认这套接线能不能用" vertical>
        <div class="test">
          <button class="btn btn--primary" :disabled="store.saveState === 'saving'" @click="onTest">
            <Loader2 v-if="store.saveState === 'saving'" :size="13" class="spin" />
            <Check v-else :size="13" />
            测试连接
          </button>

          <div
            v-if="store.testResult"
            class="test__result"
            :class="store.testResult.ok ? 'test__result--ok' : 'test__result--fail'"
          >
            <component :is="testIcon" :size="13" />
            <span>{{ store.testResult.message }}</span>
          </div>
        </div>
      </SettingField>

      <!-- 降级说明 -->
      <div class="panel__warning">
        <AlertCircle :size="14" />
        <div>
          <strong>AI 完全不可用时，本软件的核心功能不受影响。</strong>
          图书馆的全文/语义检索、技术树浏览、阅读器与播放器都不依赖 AI；
          AI 只负责"回答问题"和"自动建树"这两件事。这也是为什么 AI 层被做成了可拔插的。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.key-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-muted);
}

.key-wrap__input {
  border: none;
  background: transparent;
  padding-left: 0;
}

.key-wrap__input:focus {
  border: none;
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider {
  width: 130px;
  accent-color: var(--ember-500);
}

.slider__value {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  width: 32px;
}

.test {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.test__result {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
}

.test__result--ok {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.test__result--fail {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
