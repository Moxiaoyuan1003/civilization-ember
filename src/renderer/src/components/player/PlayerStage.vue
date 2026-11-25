<script setup lang="ts">
/**
 * 播放舞台（PlayerStage）。
 *
 * 这是整页唯一持有 <video>/<audio> 元素的地方（媒体元素是命令式的，
 * 只在组件里操作 DOM，状态仍统一走 store）。
 *
 * 三种形态：
 * - local / remote：真实媒体播放 + 自定义控制条（播放、进度、音量、全屏）。
 * - transcript-only：没有原片，舞台上放一个"原片已遗失"的说明卡，仍可播完文字。
 * - 媒体报错：退化成说明卡，提示可能的原因，而不是白屏。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Film,
  AlertTriangle,
  FileAudio
} from 'lucide-vue-next'

const store = usePlayerStore()

/** 媒体元素引用 */
const mediaEl = ref<HTMLVideoElement | null>(null)
/** 进度条容器（用于点击 seek） */
const barRef = ref<HTMLElement | null>(null)

const isVideo = computed(() => store.carrier?.type === 'video')

/** 秒 → mm:ss */
function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 播放/暂停切换 */
async function togglePlay(): Promise<void> {
  const el = mediaEl.value
  if (!el) return
  if (el.paused) {
    try {
      await el.play()
    } catch {
      // 自动播放被拦或解码失败：保持暂停，由 onError 显示原因
    }
  } else {
    el.pause()
  }
}

/** 快退 / 快进 10 秒 */
function skip(delta: number): void {
  const el = mediaEl.value
  if (!el) return
  const target = Math.min(Math.max(0, el.currentTime + delta), store.durationSec || el.duration || 0)
  el.currentTime = target
  store.setCurrentSec(target)
}

/** 进度条点击 seek */
function onBarClick(e: MouseEvent): void {
  const bar = barRef.value
  const el = mediaEl.value
  if (!bar || !el) return
  const rect = bar.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  const total = store.durationSec || el.duration || 0
  if (!total) return
  el.currentTime = ratio * total
  store.setCurrentSec(el.currentTime)
}

/** 全屏 */
async function toggleFullscreen(): Promise<void> {
  const el = mediaEl.value
  if (!el) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  } catch {
    // 全屏被拒（有些环境不允许），静默忽略
  }
}

/* ---------- 媒体元素事件 → store ---------- */
function onTimeUpdate(): void {
  const el = mediaEl.value
  if (el) store.setCurrentSec(el.currentTime)
}

function onLoadedMetadata(): void {
  const el = mediaEl.value
  if (!el) return
  store.setDuration(el.duration)
  // 恢复上次位置（store 在 load 时已把 currentSec 设成上次的秒数）
  if (store.currentSec > 0 && store.currentSec < el.duration) el.currentTime = store.currentSec
  el.playbackRate = store.rate
  el.muted = store.muted
}

function onPlay(): void {
  store.setPlaying(true)
}

function onPause(): void {
  store.setPlaying(false)
}

function onEnded(): void {
  store.setPlaying(false)
}

function onError(): void {
  store.setMediaError('媒体无法解码：可能是文件损坏、编码不支持，或原片已被替换。')
}

/* ---------- store → 媒体元素 ---------- */
// 点转写某句 → 把播放头定到那句（只认显式跳转请求 seekSeq，
// 不监听 activeSegment，否则自然播放跨段或被拖进度条跨段时会误跳回段首）
watch(
  () => store.seekSeq,
  () => {
    const el = mediaEl.value
    if (!el) return
    const target = store.seekTarget
    el.currentTime = target
    store.setCurrentSec(target)
  }
)

watch(
  () => store.rate,
  (r) => {
    if (mediaEl.value) mediaEl.value.playbackRate = r
  }
)

watch(
  () => store.muted,
  (m) => {
    if (mediaEl.value) mediaEl.value.muted = m
  }
)

onMounted(() => {
  // 媒体元素挂载后同步一次状态
  const el = mediaEl.value
  if (el) {
    el.playbackRate = store.rate
    el.muted = store.muted
  }
})
</script>

<template>
  <section class="stage">
    <!-- 加载中 -->
    <div v-if="store.loading" class="stage__placeholder">
      <div class="stage__spinner"></div>
      <p>正在准备媒体…</p>
    </div>

    <!-- 加载失败（找不到载体 / 不是音视频） -->
    <div v-else-if="store.error" class="stage__placeholder">
      <AlertTriangle :size="34" class="stage__icon-stage stage__icon-stage--warn" />
      <p class="stage__ph-title">无法打开</p>
      <p class="stage__ph-note">{{ store.error }}</p>
    </div>

    <!-- 原片已遗失：只有转写 -->
    <div v-else-if="!store.playable" class="stage__placeholder">
      <FileAudio :size="34" class="stage__icon-stage" />
      <p class="stage__ph-title">原片已遗失，知识还在</p>
      <p class="stage__ph-note">{{ store.source?.note }}</p>
      <p class="stage__ph-hint">右侧是转写下来的全文，按时间轴排列，点任意一句即可定位。</p>
    </div>

    <!-- 媒体解码失败 -->
    <div v-else-if="store.mediaError" class="stage__placeholder">
      <AlertTriangle :size="34" class="stage__icon-stage stage__icon-stage--warn" />
      <p class="stage__ph-title">媒体无法解码</p>
      <p class="stage__ph-note">{{ store.mediaError }}</p>
    </div>

    <!-- 真实播放 -->
    <template v-else>
      <div class="stage__media" :class="{ 'stage__media--audio': !isVideo }">
        <video
          v-if="isVideo"
          ref="mediaEl"
          class="stage__video"
          :src="store.source?.src"
          preload="metadata"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
          @error="onError"
          @click="togglePlay"
        ></video>

        <div v-else class="stage__audiobox">
          <div class="stage__audioart" :class="{ 'stage__audioart--on': store.playing }">
            <Film :size="40" />
          </div>
          <audio
            ref="mediaEl"
            class="stage__audio"
            :src="store.source?.src"
            preload="metadata"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
            @error="onError"
          ></audio>
        </div>
      </div>

      <!-- 自定义控制条 -->
      <div class="ctrl">
        <button class="ctrl__btn" title="后退 10 秒" @click="skip(-10)">
          <SkipBack :size="16" />
        </button>
        <button class="ctrl__play" :title="store.playing ? '暂停' : '播放'" @click="togglePlay">
          <Pause v-if="store.playing" :size="17" />
          <Play v-else :size="17" />
        </button>
        <button class="ctrl__btn" title="前进 10 秒" @click="skip(10)">
          <SkipForward :size="16" />
        </button>

        <span class="ctrl__time">{{ clock(store.currentSec) }}</span>

        <div ref="barRef" class="ctrl__bar" @click="onBarClick">
          <div class="ctrl__track">
            <div class="ctrl__fill" :style="{ width: `${store.percent * 100}%` }"></div>
            <div class="ctrl__knob" :style="{ left: `${store.percent * 100}%` }"></div>
          </div>
        </div>

        <span class="ctrl__time ctrl__time--total">{{ clock(store.durationSec) }}</span>

        <button class="ctrl__btn" title="全屏" @click="toggleFullscreen">
          <Maximize2 :size="15" />
        </button>
      </div>

      <!-- 说明条：告诉用户这段媒体是怎么来的 -->
      <div v-if="store.source?.note" class="stage__note">{{ store.source.note }}</div>
    </template>
  </section>
</template>

<style scoped>
.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-base);
  padding: 16px 20px 14px;
}

.stage__media {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}

.stage__media--audio {
  background: linear-gradient(160deg, color-mix(in srgb, var(--ember-600) 22%, #0b0906), #08070a);
}

.stage__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}

.stage__audiobox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.stage__audio {
  display: none;
}

.stage__audioart {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ember-500) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--ember-500) 35%, transparent);
  color: var(--ember-300);
  transition: all 0.4s;
}

.stage__audioart--on {
  transform: scale(1.06);
  box-shadow: 0 0 42px color-mix(in srgb, var(--ember-500) 30%, transparent);
}

/* 控制条 */
.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 4px 2px;
  flex-shrink: 0;
}

.ctrl__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.ctrl__btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.ctrl__play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--ember-500);
  color: #1a1206;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl__play:hover {
  filter: brightness(1.1);
}

.ctrl__time {
  font-size: 11.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.ctrl__time--total {
  color: var(--text-muted);
}

.ctrl__bar {
  flex: 1;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.ctrl__track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-surface-hover);
}

.ctrl__fill {
  height: 100%;
  border-radius: 2px;
  background: var(--ember-500);
}

.ctrl__knob {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ember-300);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s;
}

.ctrl__bar:hover .ctrl__knob {
  opacity: 1;
}

.stage__note {
  font-size: 11.5px;
  color: var(--text-muted);
  padding: 8px 4px 0;
  flex-shrink: 0;
}

/* 占位 / 说明卡 */
.stage__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
}

.stage__icon-stage {
  color: var(--ember-400);
  opacity: 0.85;
}

.stage__icon-stage--warn {
  color: var(--warning);
}

.stage__ph-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 4px 0 0;
}

.stage__ph-note {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 460px;
  line-height: 1.7;
}

.stage__ph-hint {
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 2px 0 0;
  max-width: 460px;
}

.stage__spinner {
  width: 26px;
  height: 26px;
  border: 2px solid var(--border-color);
  border-top-color: var(--ember-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
