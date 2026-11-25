<script setup lang="ts">
/**
 * 账号与设备设置面板（AccountPanel）。
 *
 * 这一页要讲清一件事：**哪些数据属于你、哪些属于火种本身。**
 * 这是全局数据模型在界面上的呈现，也是将来做多用户/多设备同步的地基。
 *
 * 当前是单机单用户（第 6 期范围），这里如实说明并把入口留好：
 * - 当前用户（自动生成的本机身份）
 * - 个人数据统计（收藏/标注/掌握/进度各多少条）
 * - 数据归属说明（共享 vs 个人）
 * - 多用户与同步：留白，标注"后续接入"
 */

import { computed, onMounted, ref, watch } from 'vue'
import { User, Shield, Share2, Download, Upload, Info, Cloud } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { useServices } from '@/services'
import SettingField from './SettingField.vue'

const store = useSettingsStore()

/** 个人数据统计 */
const stats = ref({
  favorites: 0,
  annotations: 0,
  mastery: 0,
  progress: 0
})

/** 当前用户 id 短显示 */
const shortId = computed(() => store.user?.id ?? '—')

/** 用户创建日期 */
const createdLabel = computed(() => {
  const iso = store.user?.createdAt
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
})

/** 读个人数据条数（只读统计，不展示内容） */
async function loadStats(): Promise<void> {
  const services = useServices()
  const uid = store.user?.id
  if (!uid) return
  const [favs, mastery, carriers] = await Promise.all([
    services.storage.listFavorites(uid),
    services.storage.listMastery(uid),
    services.storage.listCarriers()
  ])

  // 标注与阅读进度都是"按载体"查的接口，这里逐载体聚合成总数
  let annotationCount = 0
  let progressCount = 0
  for (const c of carriers) {
    const [anns, prog] = await Promise.all([
      services.storage.listAnnotations(uid, c.id),
      services.storage.getReadingProgress(uid, c.id)
    ])
    annotationCount += anns.length
    if (prog) progressCount += 1
  }

  stats.value = {
    favorites: favs.length,
    annotations: annotationCount,
    mastery: mastery.filter((m) => m.mastered).length,
    progress: progressCount
  }
}

onMounted(() => {
  void loadStats()
})

// 用户信息可能比本组件晚到（设置页 load 是异步的），到齐了再统计一次
watch(
  () => store.user?.id,
  (id) => {
    if (id) void loadStats()
  }
)
</script>

<template>
  <div class="panel">
    <div class="panel__intro">
      <h2>账号与设备</h2>
      <p>
        火种本身只有一份（技术树、载体、依赖关系是共享的）；
        而"读到哪、掌握了什么、收藏了哪些"是你个人的，按用户分开记。
      </p>
    </div>

    <!-- 当前用户 -->
    <div class="profile">
      <div class="profile__avatar">
        <User :size="20" />
      </div>
      <div class="profile__info">
        <div class="profile__name">{{ store.userName }}</div>
        <div class="profile__meta">本机身份 · {{ shortId }} · 创建于 {{ createdLabel }}</div>
      </div>
      <span class="profile__badge">单用户模式</span>
    </div>

    <!-- 个人数据统计 -->
    <div class="stats">
      <div class="stats__cell">
        <span class="stats__value">{{ stats.favorites }}</span>
        <span class="stats__label">收藏</span>
      </div>
      <div class="stats__cell">
        <span class="stats__value">{{ stats.annotations }}</span>
        <span class="stats__label">标注</span>
      </div>
      <div class="stats__cell">
        <span class="stats__value">{{ stats.mastery }}</span>
        <span class="stats__label">已掌握节点</span>
      </div>
      <div class="stats__cell">
        <span class="stats__value">{{ stats.progress }}</span>
        <span class="stats__label">在读载体</span>
      </div>
    </div>

    <div class="panel__body">
      <!-- 数据归属说明 -->
      <SettingField label="数据归属" hint="这条分界线决定了将来多设备同步时，什么该同步、什么不该" vertical>
        <div class="split">
          <div class="split__col">
            <div class="split__head">
              <Share2 :size="13" />
              全局共享（火种本体）
            </div>
            <ul>
              <li>技术树节点与依赖边</li>
              <li>载体文件与元信息</li>
              <li>节点与载体的引用关系</li>
            </ul>
          </div>
          <div class="split__col split__col--personal">
            <div class="split__head">
              <Shield :size="13" />
              个人数据（按用户）
            </div>
            <ul>
              <li>收藏、标注、已掌握</li>
              <li>阅读进度</li>
              <li>布局快照、界面偏好、模块开关</li>
            </ul>
          </div>
        </div>
      </SettingField>

      <!-- 备份与迁移 -->
      <SettingField label="个人数据导出" hint="导出一份 JSON，换机器时可导入（含偏好与个人记录，不含载体文件）">
        <div class="btns">
          <button class="btn" disabled title="第 7 期接入">
            <Download :size="13" />
            导出
          </button>
          <button class="btn" disabled title="第 7 期接入">
            <Upload :size="13" />
            导入
          </button>
        </div>
      </SettingField>

      <!-- 多用户与同步（留白） -->
      <SettingField label="多用户与多设备" hint="NAS 上多人共用、多端同步进度——接口已预留，等后端接上再开放">
        <div class="pending">
          <Cloud :size="13" />
          <span>后续接入</span>
        </div>
      </SettingField>
    </div>

    <div class="panel__note">
      <Info :size="13" />
      <span>
        为什么现在只有一个用户？因为这一期只做"本地单机"。
        数据层已经按 userId 隔离好了，将来加账号系统不用改任何页面的读写逻辑。
      </span>
    </div>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-bottom: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.profile__avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ember-500) 16%, transparent);
  color: var(--ember-400);
  flex-shrink: 0;
}

.profile__info {
  flex: 1;
  min-width: 0;
}

.profile__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.profile__meta {
  font-size: 11px;
  color: var(--text-muted);
}

.profile__badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  flex-shrink: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.stats__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.stats__value {
  font-size: 17px;
  font-weight: 700;
  color: var(--ember-400);
  font-variant-numeric: tabular-nums;
}

.stats__label {
  font-size: 11px;
  color: var(--text-muted);
}

/* 数据归属两列 */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}

.split__col {
  padding: 11px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 9px;
}

.split__col--personal {
  border-color: color-mix(in srgb, var(--ember-500) 28%, var(--border-color));
}

.split__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 7px;
}

.split__col ul {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.85;
  color: var(--text-muted);
}

.btns {
  display: flex;
  gap: 7px;
}

.pending {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 20px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
