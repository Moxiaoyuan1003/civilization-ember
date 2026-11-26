<script setup lang="ts">
/**
 * 载体封面（CarrierCover）。
 *
 * 有 coverUrl 时渲染封面图；没有时用"类型图标 + 标题"拼一张占位封面。
 * 占位封面的底色取自 carrierTypeMeta.color（按类型区分），书/视频/音频/网页各有辨识度。
 * 尺寸由外部通过 CSS（宽高/字体）控制，本组件只负责内容。
 */

import { computed } from 'vue'
import type { Carrier } from '@shared/types/carrier'
import { carrierTypeMeta } from './carrierMeta'
import { resolveCover } from '@/assets/covers'

const props = defineProps<{ carrier: Carrier }>()

const meta = computed(() => carrierTypeMeta(props.carrier.type))

/**
 * 封面源：优先本地注册表（assets/covers/index.ts），其次载体 coverUrl，
 * 都没有则为 undefined → 走占位封面。
 */
const coverSrc = computed(() => resolveCover(props.carrier.id, props.carrier.coverUrl))
</script>

<template>
  <div class="cover" :class="{ 'cover--img': !!coverSrc }">
    <!-- 真实封面图 -->
    <img v-if="coverSrc" :src="coverSrc" :alt="carrier.title" class="cover__img" />

    <!-- 占位封面 -->
    <template v-else>
      <div class="cover__placeholder" :style="{ background: meta.color }">
        <component :is="meta.icon" :size="40" class="cover__icon" />
        <span class="cover__title">{{ carrier.title }}</span>
        <span class="cover__type">{{ meta.label }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cover {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-elevated);
  display: flex;
}

.cover__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
}

.cover__icon {
  opacity: 0.9;
}

.cover__title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.cover__type {
  font-size: 11px;
  opacity: 0.75;
}
</style>
