<script setup lang="ts">
/**
 * 阅读正文区（ReaderCanvas）。
 *
 * 两种阅读模式（"双模式可插拔"）：
 * - page：单页翻页，版心固定，左右键/按钮翻页。
 * - scroll：连续滚动，滚到哪算哪页（用每页的 element 位置反推当前页）。
 *
 * 选中文字后会浮出一个小工具条，可以"划线"或"写笔记"，
 * 落库成 Annotation（位置记为 P<页码>），与 Mock 里 P156/P180 的记录同构。
 */

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useReaderStore } from '@/stores/reader'
import { Highlighter, PenLine, X } from 'lucide-vue-next'

const store = useReaderStore()

/** 滚动模式下所有页的容器引用（用于反推当前页） */
const scrollRoot = ref<HTMLElement | null>(null)
/** 选中浮动条的位置 */
const tip = ref<{ x: number; y: number } | null>(null)
/** 是否正在写笔记 */
const noting = ref(false)

/** 当前页标注里已经存在的文本（用于把已划线句子标出来） */
const highlightedTexts = computed(() => new Set(store.pageAnnotations.map((a) => a.text)))

/** 进入页码（滚动模式滚动到对应页） */
async function scrollToPage(pageNo: number): Promise<void> {
  await nextTick()
  const root = scrollRoot.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-page="${pageNo}"]`)
  if (el) root.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
}

/** 处理文字选择：出现浮动工具条 */
function onMouseUp(): void {
  const sel = window.getSelection()
  const text = sel?.toString().trim() ?? ''
  if (!text || text.length < 2) {
    tip.value = null
    return
  }
  // 只接受落在正文页里的选择（注意：正文页 class 是 canvas__page，
  // 曾经这里误写成不存在的 canvas__body，导致工具条永远不出现）
  const anchor = sel?.anchorNode?.parentElement
  if (!anchor?.closest('.canvas__page')) {
    tip.value = null
    return
  }
  store.setSelection(text)
  // 用选区位置定位浮动条
  const rect = sel?.getRangeAt(0).getBoundingClientRect()
  if (rect) {
    tip.value = { x: rect.left + rect.width / 2, y: rect.top - 8 }
  }
}

/** 划线（直接存原文） */
async function doHighlight(): Promise<void> {
  await store.addAnnotation('highlight', store.selectionText)
  tip.value = null
  noting.value = false
  window.getSelection()?.removeAllRanges()
}

/** 打开笔记输入 */
function doNote(): void {
  noting.value = true
}

/** 提交笔记 */
async function submitNote(): Promise<void> {
  if (!store.annotationInput.trim()) return
  await store.addAnnotation('note', store.annotationInput)
  tip.value = null
  noting.value = false
  window.getSelection()?.removeAllRanges()
}

/** 关掉浮动条 */
function dismiss(): void {
  tip.value = null
  noting.value = false
  store.clearSelection()
}

/** 键盘翻页（翻页模式下左右方向键） */
function onKeydown(e: KeyboardEvent): void {
  if (store.mode !== 'page') return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === 'ArrowLeft') store.prevPage()
  else if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    store.nextPage()
  }
}

/** 滚动模式下判断当前页（用不可见标记的视口位置反推） */
function onScroll(): void {
  if (store.mode !== 'scroll') return
  const root = scrollRoot.value
  if (!root) return
  const marks = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'))
  const top = root.scrollTop + 80
  let cur = 1
  for (const m of marks) {
    if (m.offsetTop <= top) cur = Number(m.dataset.page)
  }
  if (cur !== store.currentPage) store.goPage(cur)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

// 翻页模式下切页时把滚动容器回到顶部
watch(
  () => store.currentPage,
  (p) => {
    if (store.mode === 'scroll') void scrollToPage(p)
  }
)

// 进入滚动模式时定位到当前页
watch(
  () => store.mode,
  (m) => {
    if (m === 'scroll') void scrollToPage(store.currentPage)
  }
)
</script>

<template>
  <div
    ref="scrollRoot"
    class="canvas"
    :class="`canvas--${store.mode}`"
    @mouseup="onMouseUp"
    @scroll.passive="onScroll"
  >
    <!-- 翻页模式：只渲染当前页 -->
    <article v-if="store.mode === 'page' && store.page" class="canvas__page">
      <div class="canvas__chapter">{{ store.page.chapter }}</div>
      <p
        v-for="(para, i) in store.page.paragraphs"
        :key="i"
        class="canvas__para"
        :style="{ fontSize: `${store.fontSize}px` }"
      >
        {{ para }}
      </p>
      <div v-if="store.pageAnnotations.length" class="canvas__anns">
        <div class="canvas__anns-title">本页笔记</div>
        <div v-for="a in store.pageAnnotations" :key="a.id" class="canvas__ann">
          <span class="canvas__ann-kind">{{ a.kind === 'highlight' ? '划线' : '笔记' }}</span>
          <span class="canvas__ann-text">{{ a.text }}</span>
        </div>
      </div>
      <div class="canvas__folio">— {{ store.currentPage }} —</div>
    </article>

    <!-- 滚动模式：连续渲染全部页 -->
    <template v-else-if="store.mode === 'scroll'">
      <article
        v-for="p in store.doc?.pages ?? []"
        :key="p.pageNo"
        :data-page="p.pageNo"
        class="canvas__page canvas__page--flow"
      >
        <div class="canvas__chapter">{{ p.chapter }}</div>
        <p
          v-for="(para, i) in p.paragraphs"
          :key="i"
          class="canvas__para"
          :class="{ 'canvas__para--hl': highlightedTexts.has(para) }"
          :style="{ fontSize: `${store.fontSize}px` }"
        >
          {{ para }}
        </p>
        <div class="canvas__folio">— {{ p.pageNo }} —</div>
      </article>
    </template>

    <!-- 选中文字后的浮动工具条 -->
    <div
      v-if="tip && store.selectionText"
      class="tip"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      @mousedown.prevent
    >
      <template v-if="!noting">
        <button class="tip__btn" @click="doHighlight">
          <Highlighter :size="13" />
          <span>划线</span>
        </button>
        <button class="tip__btn" @click="doNote">
          <PenLine :size="13" />
          <span>笔记</span>
        </button>
        <button class="tip__close" title="取消" @click="dismiss">
          <X :size="12" />
        </button>
      </template>
      <template v-else>
        <input
          v-model="store.annotationInput"
          class="tip__input"
          placeholder="写点想法…"
          autofocus
          @keyup.enter="submitNote"
        />
        <button class="tip__btn tip__btn--go" @click="submitNote">保存</button>
        <button class="tip__close" title="取消" @click="dismiss">
          <X :size="12" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-base);
  position: relative;
}

.canvas__page {
  max-width: 720px;
  margin: 0 auto;
  padding: 44px 56px 60px;
}

.canvas__page--flow {
  padding-bottom: 36px;
  border-bottom: 1px solid var(--border-color);
}

.canvas__chapter {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ember-500);
  text-transform: uppercase;
  margin-bottom: 20px;
}

.canvas__para {
  line-height: 1.95;
  color: var(--text-primary);
  margin: 0 0 1.15em;
  text-align: justify;
  /* 阅读区可以选择文字（body 全局禁用了选择，这里要放开） */
  user-select: text;
  cursor: text;
}

.canvas__para--hl {
  background: color-mix(in srgb, var(--ember-500) 16%, transparent);
  border-radius: 3px;
}

.canvas__anns {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-color);
}

.canvas__anns-title {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.canvas__ann {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
  padding: 4px 0;
}

.canvas__ann-kind {
  flex-shrink: 0;
  color: var(--ember-500);
}

.canvas__ann-text {
  min-width: 0;
}

.canvas__folio {
  text-align: center;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 30px;
  font-variant-numeric: tabular-nums;
}

/* 选中浮动工具条 */
.tip {
  position: fixed;
  transform: translate(-50%, -100%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
  z-index: 60;
}

.tip__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.tip__btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.tip__btn--go {
  color: var(--ember-400);
}

.tip__input {
  width: 210px;
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12.5px;
  outline: none;
}

.tip__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.tip__close:hover {
  color: var(--text-primary);
}
</style>
