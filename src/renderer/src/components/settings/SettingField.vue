<script setup lang="ts">
/**
 * 设置项通用外壳（SettingField）。
 *
 * 目的是"设置页长一个样"：标题 + 说明 + 右侧控件槽，避免每个面板重复写布局。
 * 三处都用到它的地方：AI 面板、转写面板、存储面板。
 */

defineProps<{
  /** 设置项标题 */
  label: string
  /** 说明文字（解释这个选项在干嘛、为什么） */
  hint?: string
  /** 是否竖向排布（默认横向：左标题右控件；竖向用于长控件如按钮行） */
  vertical?: boolean
}>()
</script>

<template>
  <div class="field" :class="{ 'field--vertical': vertical }">
    <div class="field__text">
      <div class="field__label">{{ label }}</div>
      <div v-if="hint" class="field__hint">{{ hint }}</div>
    </div>
    <div class="field__control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.field:last-child {
  border-bottom: none;
}

.field--vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.field__text {
  min-width: 0;
  flex: 1;
}

.field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
}

.field__hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.55;
}

.field__control {
  flex-shrink: 0;
}

.field--vertical .field__control {
  flex-shrink: 1;
}
</style>
