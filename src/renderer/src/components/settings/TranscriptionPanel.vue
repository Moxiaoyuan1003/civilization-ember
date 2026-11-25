<script setup lang="ts">
/**
 * 转写引擎设置面板（TranscriptionPanel）。
 *
 * 为什么这页重要：视频/音频里的知识只能靠转写变成文字，
 * 转写引擎直接决定"能不能查到视频里那句话"。
 *
 * 双模式可插拔的落点：引擎/设备/语言/模型规格全部可换，
 * 默认给一套能跑的（faster-whisper + CUDA + 自动语言 + medium）。
 */

import { computed } from 'vue'
import { Gauge, Info, Cpu, Languages, Boxes } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { TRANSCRIPTION_ENGINES } from '@/types/settings'
import SettingField from './SettingField.vue'

const store = useSettingsStore()

/** 转写设置快捷引用 */
const ts = computed(() => store.appSettings.transcription)

/** 当前引擎说明 */
const engineDesc = computed(
  () => TRANSCRIPTION_ENGINES.find((e) => e.value === ts.value.engine)?.desc ?? ''
)

/** 模型规格选项（越大越准越慢） */
const MODEL_SIZES = [
  { value: 'tiny', label: 'tiny（最快，够听清）' },
  { value: 'base', label: 'base' },
  { value: 'small', label: 'small' },
  { value: 'medium', label: 'medium（推荐，平衡）' },
  { value: 'large', label: 'large（最准，吃显存）' }
] as const

/** 输入变化标记待保存 */
function onChange(): void {
  store.markDirty()
}
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>转写引擎</h2>
      <p>
        视频和音频里的知识，靠转写变成可检索的文字。
        转写在本机跑（吃显卡和时间），这里决定用哪套引擎、多大模型。
      </p>
    </div>

    <div class="panel__body">
      <!-- 引擎 -->
      <SettingField label="转写引擎" hint="可插拔：换引擎不影响已转写的内容">
        <select v-model="ts.engine" class="ctl ctl--select" @change="onChange">
          <option v-for="e in TRANSCRIPTION_ENGINES" :key="e.value" :value="e.value">
            {{ e.label }}
          </option>
        </select>
      </SettingField>

      <div class="panel__note">
        <Info :size="13" />
        <span>{{ engineDesc }}</span>
      </div>

      <!-- 设备 -->
      <SettingField label="算力设备" hint="有独立显卡用 CUDA（快几十倍）；没有就选 CPU（慢但能跑）">
        <select v-model="ts.device" class="ctl ctl--select" @change="onChange">
          <option value="cuda">显卡（CUDA）</option>
          <option value="cpu">处理器（CPU）</option>
        </select>
      </SettingField>

      <!-- 语言 -->
      <SettingField label="识别语言" hint="指定语言比自动检测更准；中英混杂的访谈建议自动">
        <select v-model="ts.language" class="ctl ctl--select" @change="onChange">
          <option value="auto">自动检测</option>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </SettingField>

      <!-- 模型规格 -->
      <SettingField label="模型规格" hint="规格越大越准，但更慢、更吃显存">
        <select v-model="ts.modelSize" class="ctl ctl--select" @change="onChange">
          <option v-for="m in MODEL_SIZES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </SettingField>

      <!-- 三格说明 -->
      <div class="facts">
        <div class="facts__item">
          <Gauge :size="14" />
          <div>
            <strong>速度参考</strong>
            <span>显卡 medium 模型约 1 小时音频 5–10 分钟</span>
          </div>
        </div>
        <div class="facts__item">
          <Cpu :size="14" />
          <div>
            <strong>CPU 兜底</strong>
            <span>没独立显卡时 whisper.cpp 也能跑，约慢 5–10 倍</span>
          </div>
        </div>
        <div class="facts__item">
          <Languages :size="14" />
          <div>
            <strong>时间戳</strong>
            <span>转写结果带每句起止时间，播放器可跳转定位</span>
          </div>
        </div>
        <div class="facts__item">
          <Boxes :size="14" />
          <div>
            <strong>可换引擎</strong>
            <span>openai-whisper / faster-whisper / whisper.cpp / FunASR / SenseVoice</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px 0 10px;
}

.facts__item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px;
  background: var(--bg-elevated);
  border-radius: 9px;
  color: var(--text-muted);
}

.facts__item div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.facts__item strong {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.facts__item span {
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
