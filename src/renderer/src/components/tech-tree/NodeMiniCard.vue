<script setup lang="ts">
/**
 * 节点迷你卡（NodeMiniCard）。
 *
 * 悬停节点时在指针附近显示的小浮层：名称 + 层 + 一句话摘要。
 * 悬停离开即隐藏（由 store.hoveredNode 控制显隐）。
 */

import { computed } from 'vue'
import { layerOf } from '@shared/types/layer'
import type { TechNode } from '@shared/types/techTree'

const props = defineProps<{ node: TechNode; x: number; y: number }>()

const layerMeta = computed(() => layerOf(props.node.layer))
</script>

<template>
  <div
    class="minicard"
    :style="{ left: `${x + 14}px`, top: `${y + 14}px` }"
  >
    <div class="minicard__head">
      <span class="minicard__dot" :style="{ background: `var(--layer-${node.layer})` }"></span>
      <span class="minicard__name">{{ node.name }}</span>
    </div>
    <div class="minicard__layer">{{ layerMeta.name }} · L{{ node.layer }}</div>
    <p class="minicard__summary">{{ node.summary }}</p>
  </div>
</template>

<style scoped>
.minicard {
  position: absolute;
  z-index: 50;
  width: 220px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.minicard__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.minicard__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.minicard__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.minicard__layer {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.minicard__summary {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 6px 0 0;
}
</style>
