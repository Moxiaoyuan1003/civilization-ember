<script setup lang="ts">
/**
 * 出处内嵌预览（CitationPreview）。
 *
 * 当偏好 citationClick='preview' 时，点出处先弹这张小卡片：
 * - 显示载体类型、标题、命中位置、引用说明。
 * - 再次点击卡片 → 跳转到对应阅读器/播放器（载体类型决定）。
 * - 右上角关闭。
 *
 * 这是"内嵌优先、再次点击跳对应页、也可直接跳转"里"内嵌优先"的落点。
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { carrierTypeMeta } from '@/components/library/carrierMeta'
import { X, ExternalLink, BookOpen } from 'lucide-vue-next'

const store = useChatStore()
const router = useRouter()
const { previewCitation, carrierMap } = storeToRefs(store)

/** 当前预览的载体对象 */
const carrier = computed(() =>
  previewCitation.value ? carrierMap.value.get(previewCitation.value.carrierId) ?? null : null
)

/** 类型元信息 */
const typeMeta = computed(() => (carrier.value ? carrierTypeMeta(carrier.value.type) : null))

/** 跳转到对应阅读器/播放器 */
function jump(): void {
  if (!previewCitation.value || !carrier.value) return
  const isAV = carrier.value.type === 'video' || carrier.value.type === 'audio'
  void router.push({
    path: isAV ? `/player/${carrier.value.id}` : `/reader/${carrier.value.id}`
  })
}

/** 关闭预览 */
function close(): void {
  store.closePreview()
}
</script>

<template>
  <div v-if="previewCitation" class="preview">
    <header class="preview__head">
      <BookOpen :size="14" class="preview__icon" />
      <div class="preview__titles">
        <span class="preview__title">{{ carrier?.title ?? previewCitation.carrierId }}</span>
        <span class="preview__sub">
          {{ typeMeta?.label ?? '载体' }} · 位置 {{ previewCitation.location }}
        </span>
      </div>
      <button class="preview__close" title="关闭预览" @click="close">
        <X :size="14" />
      </button>
    </header>

    <p v-if="previewCitation.note" class="preview__note">{{ previewCitation.note }}</p>

    <footer class="preview__foot">
      <button class="preview__jump" @click="jump">
        <ExternalLink :size="14" />
        <span>前往阅读</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.preview {
  background: var(--bg-elevated);
  border: 1px solid var(--ember-500);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  width: 320px;
}

.preview__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview__icon {
  color: var(--ember-400);
  flex-shrink: 0;
}

.preview__titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview__title {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview__sub {
  font-size: 11px;
  color: var(--text-muted);
}

.preview__close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.preview__close:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.preview__note {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.preview__foot {
  display: flex;
  justify-content: flex-end;
}

.preview__jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background: var(--ember-600);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.preview__jump:hover {
  background: var(--ember-500);
}
</style>
