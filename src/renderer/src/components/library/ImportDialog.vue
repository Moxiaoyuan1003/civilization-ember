<script setup lang="ts">
/**
 * 入库对话框（ImportDialog）。
 *
 * 三种入库方式，第 9 期起**全部是真的**：
 * - 上传文件：弹系统文件选择框 → 算 SHA-256 → 去重 → 复制进对象仓 → 入队列。
 * - 网页 URL：真抓 HTML、抽正文、下载图片存库。
 * - 监控文件夹：起 chokidar 监视，丢进目录的文件自动入库。
 *
 * 界面上的三条产品判断：
 * 1. **每条结果都单独回显**，不是笼统一句"导入成功"。
 *    选了 5 个文件、其中 2 个是库里已有的，用户需要看到"3 个新增、2 个已存在"。
 * 2. **重复不是错误**。内容哈希相同的文件显示成灰色的"已在库中"，
 *    而不是红色报错——那是去重在正常工作的证据。
 * 3. **入库成功≠能读**。PDF/EPUB 的正文解析在第 10 期，
 *    所以结果里如实写"已入库，正文待解析"，不让用户点进去看到空白才发现。
 */

import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { useServices } from '@/services'
import type { ImportOutcome } from '@/services/ingest'
import { X, FilePlus, Link, FolderInput, CheckCircle2, AlertCircle, FolderCheck } from 'lucide-vue-next'

const store = useLibraryStore()
const { importOpen } = storeToRefs(store)

/** 入库方式：file / url / folder */
const mode = ref<'file' | 'url' | 'folder'>('file')

/** URL 输入 */
const urlInput = ref('')
/** 监控目录（从主进程读回的真实状态） */
const watchedDir = ref<string | null>(null)
/** 提交中 */
const submitting = ref(false)
/** 本批结果 */
const outcomes = ref<ImportOutcome[]>([])
/** 顶部错误（整体失败，比如桥接不可用） */
const errorText = ref('')
/** 监控操作提示 */
const watchNote = ref('')

const successCount = computed(() => outcomes.value.filter((o) => o.ok && !o.duplicateOf).length)
const dupCount = computed(() => outcomes.value.filter((o) => o.duplicateOf).length)
const failCount = computed(() => outcomes.value.filter((o) => !o.ok).length)

/** 关闭 */
function close(): void {
  store.setImportOpen(false)
  // 关闭时清空本批结果，下次打开是干净的
  outcomes.value = []
  errorText.value = ''
  watchNote.value = ''
}

/** 打开时读一下当前监控状态（可能上次已经设过） */
void (async () => {
  try {
    const services = useServices()
    watchedDir.value = await services.ingest.getWatchedFolder()
  } catch {
    watchedDir.value = null
  }
})()

/** 选文件并导入 */
async function pickAndImport(): Promise<void> {
  const services = useServices()
  errorText.value = ''
  submitting.value = true
  try {
    const paths = await services.ingest.pickFiles()
    if (paths.length === 0) return // 用户取消
    outcomes.value = await services.ingest.importFiles(paths)
    // 导入后刷新图书馆列表与存储统计
    await store.loadCarriers()
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}

/** 抓网页 */
async function importUrlNow(): Promise<void> {
  const services = useServices()
  const url = urlInput.value.trim()
  if (!url) return
  errorText.value = ''
  submitting.value = true
  try {
    const one = await services.ingest.importUrl(url)
    outcomes.value = [one]
    if (one.ok) await store.loadCarriers()
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : String(err)
  } finally {
    submitting.value = false
  }
}

/** 选择并开始监控目录 */
async function pickAndWatch(): Promise<void> {
  const services = useServices()
  errorText.value = ''
  watchNote.value = ''
  try {
    const dir = await services.ingest.pickFolder()
    if (!dir) return
    await services.ingest.watchFolder(dir)
    watchedDir.value = await services.ingest.getWatchedFolder()
    watchNote.value = `已开始监视：${watchedDir.value}`
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : String(err)
  }
}

/** 停止监控 */
async function stopWatch(): Promise<void> {
  const services = useServices()
  try {
    await services.ingest.unwatchFolder()
    watchedDir.value = null
    watchNote.value = '已停止监视'
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : String(err)
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
        <p class="idlg__hint">
          选 PDF / EPUB / TXT / 音视频 / 图片。文件会被复制进火种库（按内容哈希去重），
          原文件删掉也不影响。
        </p>
        <button class="idlg__drop" :disabled="submitting" @click="pickAndImport">
          <FilePlus :size="22" />
          <span>{{ submitting ? '正在导入…' : '点此选择文件（可多选）' }}</span>
        </button>
      </div>

      <!-- 网页 URL -->
      <div v-else-if="mode === 'url'" class="idlg__body">
        <p class="idlg__hint">
          粘贴网页地址。会抓取正文存档，并把页面里的图片一并存进库。
        </p>
        <input
          v-model="urlInput"
          class="idlg__input"
          placeholder="https://…"
          @keyup.enter="importUrlNow"
        />
        <button class="idlg__btn idlg__btn--primary idlg__btn--wide" :disabled="submitting || !urlInput.trim()" @click="importUrlNow">
          {{ submitting ? '抓取中…（图片多时需要几十秒）' : '抓取并存档' }}
        </button>
      </div>

      <!-- 监控文件夹 -->
      <div v-else class="idlg__body">
        <p class="idlg__hint">
          选一个目录开始监视。之后丢进该目录的文件会自动入库（适合成批灌入）。
          正在下载/复制中的文件会等写完再入库。
        </p>
        <div v-if="watchedDir" class="idlg__watch">
          <FolderCheck :size="16" />
          <div class="idlg__watch-info">
            <strong>正在监视</strong>
            <code>{{ watchedDir }}</code>
          </div>
          <button class="idlg__btn" @click="stopWatch">停止</button>
        </div>
        <button v-else class="idlg__drop" @click="pickAndWatch">
          <FolderInput :size="22" />
          <span>点此选择要监视的目录</span>
        </button>
      </div>

      <!-- 错误 -->
      <p v-if="errorText" class="idlg__error">{{ errorText }}</p>
      <p v-if="watchNote" class="idlg__ok">{{ watchNote }}</p>

      <!-- 结果回显（逐条） -->
      <div v-if="outcomes.length > 0" class="idlg__results">
        <div class="idlg__summary">
          新增 {{ successCount }} 个<template v-if="dupCount"> · 已在库 {{ dupCount }} 个</template
          ><template v-if="failCount"> · 失败 {{ failCount }} 个</template>
        </div>
        <ul class="idlg__list">
          <li v-for="(o, i) in outcomes" :key="i" class="idlg__item" :class="{ 'idlg__item--fail': !o.ok }">
            <CheckCircle2 v-if="o.ok && !o.duplicateOf" :size="14" class="idlg__ico idlg__ico--ok" />
            <AlertCircle v-else-if="!o.ok" :size="14" class="idlg__ico idlg__ico--fail" />
            <CheckCircle2 v-else :size="14" class="idlg__ico idlg__ico--dim" />
            <div class="idlg__item-text">
              <span class="idlg__item-title">{{ o.title ?? '（未知文件）' }}</span>
              <span v-if="o.duplicateOf" class="idlg__item-note">已在库中，跳过（内容完全相同）</span>
              <span v-else-if="!o.ok" class="idlg__item-note">{{ o.error }}</span>
              <span v-else class="idlg__item-note">已入库，正在排队解析</span>
            </div>
          </li>
        </ul>
      </div>

      <footer class="idlg__footer">
        <button class="idlg__btn" @click="close">关闭</button>
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
  width: 500px;
  max-height: 82vh;
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
  overflow-y: auto;
}

.idlg__hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.idlg__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 108px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.idlg__drop:hover:not(:disabled) {
  border-color: var(--ember-500);
  color: var(--ember-400);
  background: var(--bg-surface-hover);
}

.idlg__drop:disabled {
  opacity: 0.6;
  cursor: wait;
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

.idlg__wide {
  width: 100%;
}

.idlg__watch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--ember-600);
  border-radius: 10px;
  background: color-mix(in srgb, var(--ember-500) 8%, transparent);
  color: var(--ember-300);
}

.idlg__watch-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.idlg__watch-info strong {
  font-size: 12px;
}

.idlg__watch-info code {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idlg__error {
  margin: 0;
  padding: 0 18px 12px;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.5;
}

.idlg__ok {
  margin: 0;
  padding: 0 18px 12px;
  font-size: 12px;
  color: var(--success);
  line-height: 1.5;
}

.idlg__results {
  border-top: 1px solid var(--border-color);
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 260px;
}

.idlg__summary {
  font-size: 12px;
  color: var(--text-secondary);
}

.idlg__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.idlg__item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
}

.idlg__ico--ok {
  color: var(--success);
}

.idlg__ico--fail {
  color: var(--danger);
}

.idlg__ico--dim {
  color: var(--text-muted);
}

.idlg__ico {
  flex-shrink: 0;
  margin-top: 2px;
}

.idlg__item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.idlg__item-title {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idlg__item-note {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
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
