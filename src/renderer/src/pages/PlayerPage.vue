<script setup lang="ts">
/**
 * 播放器页（PlayerPage）。
 *
 * 沉浸层：隐藏侧边栏。结构 = PlayerHeader（操作）/ [PlayerStage 舞台 + TranscriptPanel 转写]。
 *
 * 一个刻意的设计：即便原片丢了（transcript-only），这页也不是空页——
 * 转写文稿照样能读、能按句定位。文明断层场景里，"片子没了但话还在"是常态。
 */

import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import PlayerHeader from '@/components/player/PlayerHeader.vue'
import PlayerStage from '@/components/player/PlayerStage.vue'
import TranscriptPanel from '@/components/player/TranscriptPanel.vue'

const route = useRoute()
const store = usePlayerStore()

onMounted(() => {
  void store.load(String(route.params.id))
})

// 同页切换载体时重新加载
watch(
  () => route.params.id,
  (id) => {
    if (id) void store.load(String(id))
  }
)

// 离开播放器前落一次进度
onUnmounted(() => {
  void store.flushProgress()
})
</script>

<template>
  <div class="player">
    <PlayerHeader />
    <div class="player__body">
      <PlayerStage />
      <TranscriptPanel v-if="store.transcriptOpen" />
    </div>
  </div>
</template>

<style scoped>
.player {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-base);
}

.player__body {
  flex: 1;
  display: flex;
  min-height: 0;
}
</style>
