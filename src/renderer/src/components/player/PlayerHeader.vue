<script setup lang="ts">
/**
 * 播放器顶栏（PlayerHeader）。
 *
 * 与阅读器顶栏同构：返回、标题、时长/进度、转写侧栏开关、播放速度、静音。
 * 播放/暂停、seek 这些"需要 DOM 媒体元素"的操作不放这里（放在舞台组件里）。
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore, PLAYBACK_RATES } from '@/stores/player'
import { ArrowLeft, PanelRight, Volume2, VolumeX } from 'lucide-vue-next'

const router = useRouter()
const store = usePlayerStore()

/** 秒 → mm:ss / h:mm:ss */
function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`
}

const timeLabel = computed(() => `${clock(store.currentSec)} / ${clock(store.durationSec)}`)

/** 返回来源页 */
function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/library')
}

/** 循环切换播放速度 */
function cycleRate(): void {
  const idx = PLAYBACK_RATES.indexOf(store.rate as (typeof PLAYBACK_RATES)[number])
  store.setRate(PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length])
}
</script>

<template>
  <header class="phead">
    <div class="phead__left">
      <button class="phead__icon" title="返回" @click="goBack">
        <ArrowLeft :size="16" />
      </button>
      <div class="phead__titles">
        <div class="phead__title">{{ store.carrier?.title ?? '播放器' }}</div>
        <div class="phead__sub">
          {{ store.carrier?.type === 'video' ? '视频' : '音频' }}
          <template v-if="store.carrier?.authors?.length">
            · {{ store.carrier.authors.join('、') }}
          </template>
        </div>
      </div>
    </div>

    <div class="phead__center">
      <span class="phead__time">{{ timeLabel }}</span>
    </div>

    <div class="phead__right">
      <button class="phead__btn" :title="`播放速度 ${store.rate}x（点击切换）`" @click="cycleRate">
        {{ store.rate }}x
      </button>
      <button
        class="phead__icon"
        :title="store.muted ? '取消静音' : '静音'"
        @click="store.toggleMuted()"
      >
        <VolumeX v-if="store.muted" :size="16" />
        <Volume2 v-else :size="16" />
      </button>
      <button
        class="phead__icon"
        :class="{ 'phead__icon--on': store.transcriptOpen }"
        title="转写文稿"
        @click="store.transcriptOpen = !store.transcriptOpen"
      >
        <PanelRight :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.phead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 48px;
  padding: 0 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.phead__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.phead__titles {
  min-width: 0;
}

.phead__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phead__sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phead__center {
  flex-shrink: 0;
}

.phead__time {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.phead__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.phead__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.phead__icon:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.phead__icon--on {
  color: var(--ember-400);
  background: color-mix(in srgb, var(--ember-500) 14%, transparent);
}

.phead__btn {
  min-width: 38px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.phead__btn:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}
</style>
