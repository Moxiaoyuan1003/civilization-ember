<script setup lang="ts">
/**
 * 阅读器页（ReaderPage）。
 *
 * 沉浸层：隐藏侧边栏（router meta.fullscreen），只留自绘标题栏 + 阅读器自己的顶栏。
 * 结构：ReaderHeader（操作）/ 中间 [ReaderToc 目录 + ReaderCanvas 正文] / 右侧笔记面板。
 *
 * 进入方式：/reader/:id（从图书馆、搜索结果、AI 出处、首页"继续阅读"等处跳进来）。
 */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import ReaderHeader from '@/components/reader/ReaderHeader.vue'
import ReaderToc from '@/components/reader/ReaderToc.vue'
import ReaderCanvas from '@/components/reader/ReaderCanvas.vue'
import { AlertTriangle, Loader2, Trash2, StickyNote } from 'lucide-vue-next'

const route = useRoute()
const store = useReaderStore()

/** 笔记面板里的筛选：全部 / 划线 / 笔记 */
const noteFilter = ref<'all' | 'highlight' | 'note'>('all')

/** 全部标注（按位置排序，位置是 P<页码>，先按数字再按时间） */
const allAnnotations = computed(() => {
  const list = store.annotations.filter((a) => noteFilter.value === 'all' || a.kind === noteFilter.value)
  return [...list].sort((a, b) => {
    const pa = Number(a.location.replace(/^P/, '')) || 0
    const pb = Number(b.location.replace(/^P/, '')) || 0
    return pa - pb || a.createdAt.localeCompare(b.createdAt)
  })
})

/** 从标注位置（P156）跳页 */
function jumpTo(location: string): void {
  const m = /^P(\d+)$/.exec(location)
  if (m) store.goPage(Number(m[1]))
}

onMounted(() => {
  void store.load(String(route.params.id))
})

// 同一页内切换载体（比如从详情页再点另一本）时重新加载
watch(
  () => route.params.id,
  (id) => {
    if (id) void store.load(String(id))
  }
)

// 离开阅读器：立刻落一次进度，别等防抖
onUnmounted(() => {
  void store.flushProgress()
})
</script>

<template>
  <div class="reader">
    <ReaderHeader />

    <!-- 加载 / 错误 -->
    <div v-if="store.loading" class="reader__state">
      <Loader2 :size="22" class="reader__spin" />
      <p>正在打开…</p>
    </div>
    <div v-else-if="store.error" class="reader__state">
      <AlertTriangle :size="26" style="color: var(--warning)" />
      <p class="reader__state-title">打不开这本书</p>
      <p class="reader__state-note">{{ store.error }}</p>
    </div>

    <!-- 正常阅读 -->
    <div v-else class="reader__body">
      <ReaderToc v-if="store.tocOpen" />
      <ReaderCanvas />

      <!-- 右侧笔记面板 -->
      <aside v-if="store.panelOpen" class="notes">
        <div class="notes__head">
          <span class="notes__title">笔记与划线</span>
          <div class="notes__seg">
            <button
              v-for="opt in [
                { k: 'all', label: '全部' },
                { k: 'highlight', label: '划线' },
                { k: 'note', label: '笔记' }
              ] as const"
              :key="opt.k"
              class="notes__segbtn"
              :class="{ 'notes__segbtn--on': noteFilter === opt.k }"
              @click="noteFilter = opt.k"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div v-if="!allAnnotations.length" class="notes__empty">
          <StickyNote :size="20" />
          <p>还没有笔记</p>
          <p class="notes__empty-note">在正文里选中一段文字，就能划线或写笔记。</p>
        </div>

        <div v-else class="notes__list">
          <div v-for="a in allAnnotations" :key="a.id" class="note">
            <button class="note__loc" @click="jumpTo(a.location)">
              第 {{ a.location.replace(/^P/, '') }} 页
            </button>
            <span class="note__kind">{{ a.kind === 'highlight' ? '划线' : '笔记' }}</span>
            <p class="note__text">{{ a.text }}</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-base);
}

.reader__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.reader__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.reader__state-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 4px 0 0;
}

.reader__state-note {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 420px;
  text-align: center;
  line-height: 1.7;
}

.reader__spin {
  animation: spin 0.9s linear infinite;
  color: var(--ember-500);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 右侧笔记面板 */
.notes {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  background: var(--bg-surface);
  min-height: 0;
}

.notes__head {
  padding: 12px 12px 8px;
  flex-shrink: 0;
}

.notes__title {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.notes__seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.notes__segbtn {
  flex: 1;
  padding: 4px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  cursor: pointer;
}

.notes__segbtn--on {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.notes__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 14px;
  min-height: 0;
}

.note {
  padding: 8px 6px 10px;
  border-bottom: 1px solid var(--border-color);
}

.note:last-child {
  border-bottom: none;
}

.note__loc {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ember-400);
  font-size: 11.5px;
  cursor: pointer;
}

.note__loc:hover {
  text-decoration: underline;
}

.note__kind {
  font-size: 10.5px;
  color: var(--text-muted);
  margin-left: 6px;
}

.note__text {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 5px 0 0;
  user-select: text;
}

.notes__empty {
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

.notes__empty p {
  margin: 0;
}

.notes__empty-note {
  font-size: 11px;
  opacity: 0.85;
}
</style>
