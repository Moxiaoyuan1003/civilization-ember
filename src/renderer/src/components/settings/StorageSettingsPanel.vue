<script setup lang="ts">
/**
 * 存储与导入设置面板（StoragePanel）。
 *
 * 三块：
 * 1. 数据目录：原文件 + 索引各放哪（上 NAS 时改这里）。
 * 2. 监控文件夹：丢进目录就自动入库（对"上万本书批量灌入"最实用）。
 * 3. 路径校验：点一下确认目录能写，避免入完库才发现写不进去。
 */

import { computed } from 'vue'
import {
  FolderOpen,
  FolderSearch,
  Radar,
  Check,
  AlertCircle,
  Database,
  Info
} from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import SettingField from './SettingField.vue'

const store = useSettingsStore()

/** 存储设置快捷引用 */
const st = computed(() => store.appSettings.storage)

function onChange(): void {
  store.markDirty()
}

/** 校验某一个路径 */
function checkPath(path: string): void {
  void store.testStorage(path)
}
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>存储与导入</h2>
      <p>
        原文件按内容哈希命名存放（同内容只存一份，自动去重）；
        索引与中间产物单独放，便于以后整体迁移到 NAS。
      </p>
    </div>

    <div class="panel__body">
      <!-- 原始载体目录 -->
      <SettingField label="原始载体目录" hint="书、视频、音频原文件放这里">
        <div class="path">
          <input v-model="st.dataDir" class="ctl ctl--input" type="text" @input="onChange" />
          <button class="btn" title="校验路径是否可写" @click="checkPath(st.dataDir)">
            <FolderOpen :size="13" />
            校验
          </button>
        </div>
      </SettingField>

      <!-- 索引目录 -->
      <SettingField label="索引目录" hint="全文索引、向量索引、转写中间产物放这里">
        <div class="path">
          <input v-model="st.indexDir" class="ctl ctl--input" type="text" @input="onChange" />
          <button class="btn" @click="checkPath(st.indexDir)">
            <FolderSearch :size="13" />
            校验
          </button>
        </div>
      </SettingField>

      <!-- 监控文件夹 -->
      <SettingField
        label="监控文件夹（自动入库）"
        hint="把文件丢进这个目录就自动进摄取队列——批量灌入上万本书时最省事"
      >
        <div class="path">
          <input
            v-model="st.watchFolder"
            class="ctl ctl--input"
            type="text"
            :disabled="!st.watchEnabled"
            @input="onChange"
          />
          <button
            class="toggle"
            :class="{ 'toggle--on': st.watchEnabled }"
            :title="st.watchEnabled ? '已开启监控' : '已关闭监控'"
            @click="
              st.watchEnabled = !st.watchEnabled;
              onChange()
            "
          />
        </div>
      </SettingField>

      <!-- 监控说明 -->
      <div class="panel__note">
        <Radar :size="13" />
        <span v-if="st.watchEnabled">
          监控已开启：目录里新出现的文件会在几秒内自动入库并排队摄取。
        </span>
        <span v-else>监控已关闭：只能手动上传或粘贴网页地址入库。</span>
      </div>

      <!-- 存储策略说明 -->
      <div class="panel__warning">
        <Database :size="14" />
        <div>
          <strong>数据可整体搬迁。</strong>
          原始文件用内容哈希（contentHash）命名，换机器、上 NAS 时把目录搬过去，
          索引可以重建，原始载体不会丢也不会重复。
        </div>
      </div>

      <!-- 结果提示 -->
      <div v-if="store.testResult" class="check-result">
        <component :is="store.testResult.ok ? Check : AlertCircle" :size="13" />
        <span>{{ store.testResult.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.path {
  display: flex;
  align-items: center;
  gap: 7px;
}

.check-result {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
</style>
