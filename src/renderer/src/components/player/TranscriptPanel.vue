<script setup lang="ts">
/**
 * 转写侧栏（TranscriptPanel）。
 *
 * 转写是音视频的"文字形态"：它既是字幕，也是目录，也是检索入口。
 * - 播放时自动跟随当前句（follow 开关），并把它滚到视野中。
 * - 点任意一句 → 播放头跳到那句的开头秒（原片没了也照样能"读"到那句话）。
 * - 支持在本栏内搜关键词过滤。
 */

import { computed, nextTick, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { Search, Quote } from 'lucide-vue-next'

const store = usePlayerStore()

/** 关键词过滤 */
const keyword = ref('')
/** 句子列表容器（用于自动滚动） */
const listRef = ref<HTMLElement | null>(null)

/** 过滤后的分段（保留原始下标，用于 seek） */
const rows = computed(() =>
  store.segments
    .map((seg, index) => ({ seg, index }))
    .filter(({ seg }) => !keyword.value || seg.text.includes(keyword.value.trim()))
)

/** 秒 → mm:ss */
function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 点某句：seek */
function goSegment(index: number): void {
  store.seekToSegment(index)
}

/** 把当前句滚进视野 */
async function scrollActiveIntoView(): Promise<void> {
  await nextTick()
  const box = listRef.value
  if (!box) return
  const el = box.querySelector<HTMLElement>(`[data-seg="${store.activeSegment}"]`)
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// 当前句变化 → 自动跟随滚动（仅在 follow 打开且没在搜索时）
watch(
  () => store.activeSegment,
  () => {
    if (store.follow && !keyword.value) void scrollActiveIntoView()
  }
)
</script>

<template>
  <aside class="tscript">
    <div class="tscript__head">
      <span class="tscript__title">转写文稿</span>
      <label class="tscript__follow" title="播放时自动滚到正在说的那句">
        <input v-model="store.follow" type="checkbox" />
        <span>跟随</span>
      </label>
    </div>

    <div class="tscript__search">
      <Search :size="13" class="tscript__searchicon" />
      <input v-model="keyword" class="tscript__searchinput" placeholder="在文稿里找…" />
    </div>

    <div v-if="!store.segments.length" class="tscript__empty">
      <Quote :size="22" />
      <p>这个载体还没有转写文本</p>
      <p class="tscript__empty-note">先到管理页把它转写一遍，就能按句检索了。</p>
    </div>

    <div v-else ref="listRef" class="tscript__list">
      <button
        v-for="row in rows"
        :key="row.index"
        :data-seg="row.index"
        class="tseg"
        :class="{ 'tseg--active': row.index === store.activeSegment }"
        @click="goSegment(row.index)"
      >
        <span class="tseg__time">{{ clock(row.seg.startSec) }}</span>
        <span class="tseg__text">{{ row.seg.text }}</span>
      </button>

      <div v-if="!rows.length" class="tscript__nomatch">没有匹配的句子</div>
    </div>
  </aside>
</template>

<style scoped>
.tscript {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  background: var(--bg-surface);
  min-height: 0;
}

.tscript__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.tscript__title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.tscript__follow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  cursor: pointer;
}

.tscript__follow input {
  accent-color: var(--ember-500);
}

.tscript__search {
  position: relative;
  padding: 0 14px 10px;
  flex-shrink: 0;
}

.tscript__searchicon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.tscript__searchinput {
  width: 100%;
  padding: 6px 8px 6px 26px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.tscript__searchinput:focus {
  border-color: var(--ember-600);
}

.tscript__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 14px;
  min-height: 0;
}

.tseg {
  display: flex;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.13s;
}

.tseg:hover {
  background: var(--bg-surface-hover);
}

.tseg--active {
  background: color-mix(in srgb, var(--ember-500) 13%, transparent);
}

.tseg__time {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding-top: 2px;
}

.tseg--active .tseg__time {
  color: var(--ember-400);
}

.tseg__text {
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  user-select: text;
}

.tseg--active .tseg__text {
  color: var(--text-primary);
}

.tscript__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px;
  text-align: center;
}

.tscript__empty p {
  margin: 0;
}

.tscript__empty-note {
  font-size: 11px;
  opacity: 0.8;
}

.tscript__nomatch {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 18px 0;
}
</style>
