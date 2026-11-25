<script setup lang="ts">
/**
 * 入库对话框（ImportDialog）。
 *
 * 三种入库方式（第 3 期先做 UI，真正文件处理第 6 期接摄取队列）：
 * - 单文件上传。
 * - 粘贴网页 URL（网页存档）。
 * - 监控文件夹（NAS 丢进目录自动入库）。
 *
 * 当前阶段：三种入口的交互形态完整，提交后写入一条"待摄取"载体，
 * 真实解析/OCR/转写由后台摄取队列处理（接口已抽象，第 6 期接）。
 */

import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { useServices } from '@/services'
import type { Carrier, CarrierType } from '@/types/carrier'
import { X, FilePlus, Link, FolderInput } from 'lucide-vue-next'

const store = useLibraryStore()
const { importOpen, user } = storeToRefs(store)

/** 入库方式：file / url / folder */
const mode = ref<'file' | 'url' | 'folder'>('file')

/** URL 输入 */
const urlInput = ref('')
/** 文件夹路径输入（监控目标） */
const folderInput = ref('')
/** 提交中 */
const submitting = ref(false)

/** 关闭 */
function close(): void {
  store.setImportOpen(false)
}

/** 提交入库（先写"待摄取"载体，真实处理交给后台队列） */
async function submit(): Promise<void> {
  const services = useServices()
  if (mode.value === 'url' && !urlInput.value.trim()) return
  if (mode.value === 'folder' && !folderInput.value.trim()) return

  submitting.value = true
  try {
    const now = new Date().toISOString()
    const base: Carrier = {
      id: `c-import-${Date.now()}`,
      title: '新入库载体',
      type: 'book' as CarrierType,
      tags: ['待处理'],
      contentHash: `hash-import-${Date.now()}`,
      status: 'pending',
      createdAt: now
    }

    if (mode.value === 'url') {
      base.type = 'webpage'
      base.title = urlInput.value.trim()
      base.sourceUrl = urlInput.value.trim()
      base.format = 'html'
    } else if (mode.value === 'folder') {
      base.title = `监控目录：${folderInput.value.trim()}`
    }

    await services.storage.addCarrier(base)
    close()
    await store.load()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="importOpen" class="idlg__mask" @click.self="close">
    <div class="idlg">
      <header class="idlg__header">
        <h2 class="idlg__title">入库</h2>
        <button class="idlg__close" title="关闭" @click="close">
          <X :size="16" />
        </button>
      </header>

      <!-- 方式切换 -->
      <div class="idlg__tabs">
        <button class="idlg__tab" :class="{ 'idlg__tab--active': mode === 'file' }" @click="mode = 'file'">
          <FilePlus :size="14" />
          <span>上传文件</span>
        </button>
        <button class="idlg__tab" :class="{ 'idlg__tab--active': mode === 'url' }" @click="mode = 'url'">
          <Link :size="14" />
          <span>网页 URL</span>
        </button>
        <button class="idlg__tab" :class="{ 'idlg__tab--active': mode === 'folder' }" @click="mode = 'folder'">
          <FolderInput :size="14" />
          <span>监控文件夹</span>
        </button>
      </div>

      <!-- 上传文件 -->
      <div v-if="mode === 'file'" class="idlg__body">
        <p class="idlg__hint">选择单个文件（PDF/EPUB/MP4/MP3/图片），入库后进入摄取队列后台解析。</p>
        <div class="idlg__drop">（文件选择将在第 6 期接入系统文件对话框）</div>
      </div>

      <!-- 网页 URL -->
      <div v-else-if="mode === 'url'" class="idlg__body">
        <p class="idlg__hint">粘贴网页地址，系统将抓取并存档（网页存档）。</p>
        <input v-model="urlInput" class="idlg__input" placeholder="https://…" />
      </div>

      <!-- 监控文件夹 -->
      <div v-else class="idlg__body">
        <p class="idlg__hint">填写要监控的目录，丢进该目录的文件会自动入库（适合万本批量灌入）。</p>
        <input v-model="folderInput" class="idlg__input" placeholder="例如 D:\火种书库" />
      </div>

      <footer class="idlg__footer">
        <button class="idlg__btn" @click="close">取消</button>
        <button class="idlg__btn idlg__btn--primary" :disabled="submitting" @click="submit">
          {{ submitting ? '入库中…' : '入库' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.idlg__mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.idlg {
  width: 460px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.idlg__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.idlg__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.idlg__close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
}

.idlg__close:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.idlg__tabs {
  display: flex;
  gap: 4px;
  padding: 12px 18px 0;
}

.idlg__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.idlg__tab--active {
  border-color: var(--ember-500);
  color: var(--ember-400);
}

.idlg__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px;
}

.idlg__hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.idlg__drop {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.idlg__input {
  height: 34px;
  padding: 0 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.idlg__input:focus {
  border-color: var(--ember-500);
}

.idlg__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-color);
}

.idlg__btn {
  height: 32px;
  padding: 0 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.idlg__btn:hover {
  background: var(--bg-surface-hover);
}

.idlg__btn--primary {
  border-color: var(--ember-500);
  color: var(--ember-400);
}

.idlg__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
