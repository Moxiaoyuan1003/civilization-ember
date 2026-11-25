/**
 * 播放器状态（Player Store）。
 *
 * 三种播放形态共用一套状态（对应 types/media.ts 的三种来源）：
 * - local / remote：真 <video>/<audio> 播放，进度按秒记。
 * - transcript-only：原片丢了，退化成"文字时间轴"，点某句就把播放头定到那句的开始秒。
 *
 * 转写（Transcript）是这页的第二主角：文字既能当字幕，也能当目录、当检索入口。
 * 所以即便片子播不了，这页也不是空页——**知识还在**。
 */

import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useServices } from '@/services'
import type { Carrier, Transcript } from '@/types/carrier'
import type { MediaSource } from '@/types/media'
import type { User } from '@/types/user'

/** 播放速度档位 */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

export const usePlayerStore = defineStore('player', () => {
  const services = useServices()

  /* ---------- 数据 ---------- */
  const carrier = ref<Carrier | null>(null)
  const source = ref<MediaSource | null>(null)
  const transcript = ref<Transcript | null>(null)
  const user = ref<User | null>(null)

  /* ---------- 播放状态 ---------- */
  const currentSec = ref(0)
  const durationSec = ref(0)
  const playing = ref(false)
  const rate = ref<number>(1)
  const muted = ref(false)
  /** 是否显示转写侧栏 */
  const transcriptOpen = ref(true)
  /** 当前高亮/跟随的分段下标（-1 = 无） */
  const activeSegment = ref(-1)
  /** 自动跟随当前句（播放时转写列表自动滚到正在说的那句） */
  const follow = ref(true)
  /**
   * 外部发起的"跳转请求"：值每次自增，配套 seekTarget 给出目标秒。
   *
   * 为什么要单独一个请求，而不是让播放器 watch activeSegment：
   * activeSegment 在"自然播放跨段"时也会变，若播放器监听它做 seek，
   * 用户拖进度条跨过段边界时就会被弹回段首——那是 bug 不是功能。
   * 所以只有"用户明确点了某句"才写请求，播放器只认请求。
   */
  const seekSeq = ref(0)
  const seekTarget = ref(0)

  /* ---------- 流程状态 ---------- */
  const loading = ref(true)
  const error = ref<string | null>(null)
  /** 媒体元素加载失败（文件损坏、编码不支持等） */
  const mediaError = ref<string | null>(null)

  /** 转写分段 */
  const segments = computed(() => transcript.value?.segments ?? [])

  /** 播放进度（0-1） */
  const percent = computed(() => {
    if (!durationSec.value) return 0
    return Math.min(1, currentSec.value / durationSec.value)
  })

  /** 下载 / 本地媒体才允许真实播放 */
  const playable = computed(() => source.value?.kind === 'local' || source.value?.kind === 'remote')

  /** 当前句索引（根据播放头落在哪个分段区间） */
  function segmentAt(sec: number): number {
    const list = segments.value
    for (let i = 0; i < list.length; i++) {
      if (sec >= list[i].startSec && sec < list[i].endSec) return i
    }
    // 落在最后一段之后：停在最后一段
    if (list.length && sec >= list[list.length - 1].endSec) return list.length - 1
    return -1
  }

  /**
   * 加载某个音视频载体。
   * 播放器组件把 <video>/<audio> 的 ref 传进来不方便，所以这里只做数据加载，
   * seek/play 这类操作由组件拿 DOM 自己调（组件里才是媒体元素的宿主）。
   */
  async function load(carrierId: string): Promise<void> {
    loading.value = true
    error.value = null
    mediaError.value = null
    carrier.value = null
    source.value = null
    transcript.value = null
    currentSec.value = 0
    durationSec.value = 0
    playing.value = false
    activeSegment.value = -1

    try {
      const [c, u] = await Promise.all([
        services.storage.getCarrier(carrierId),
        services.storage.getOrCreateUser()
      ])
      user.value = u

      if (!c) {
        error.value = '找不到这个载体'
        return
      }
      if (c.type !== 'video' && c.type !== 'audio') {
        error.value = '这个载体不是音视频，无法用播放器打开'
        return
      }
      carrier.value = c

      // 并行取：播放源 + 转写 + 上次播放进度
      const [src, tr, progress] = await Promise.all([
        services.media.resolve(c),
        services.storage.getTranscript(carrierId),
        services.storage.getReadingProgress(u.id, carrierId)
      ])
      source.value = src
      transcript.value = tr

      // 时长：优先用载体元信息（原片丢了也知道多长），没有就用转写最后一句
      durationSec.value =
        c.durationSec ?? (tr?.segments.length ? tr.segments[tr.segments.length - 1].endSec : 0)

      // 恢复上次播放位置（position 存的是秒数字符串）
      if (progress) {
        const sec = Number(progress.position)
        if (Number.isFinite(sec) && sec > 0 && sec < durationSec.value) currentSec.value = sec
      }
      activeSegment.value = segmentAt(currentSec.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '播放器加载失败'
    } finally {
      loading.value = false
    }
  }

  /** 保存播放进度（秒） */
  async function persistProgress(): Promise<void> {
    if (!user.value || !carrier.value) return
    await services.storage.saveReadingProgress({
      carrierId: carrier.value.id,
      userId: user.value.id,
      position: String(Math.floor(currentSec.value)),
      percent: percent.value,
      updatedAt: new Date().toISOString()
    })
  }

  /** 更新播放头（组件 onTimeUpdate 调用） */
  function setCurrentSec(sec: number): void {
    currentSec.value = sec
    const idx = segmentAt(sec)
    if (idx !== activeSegment.value) activeSegment.value = idx
  }

  /** 更新时间总长（组件 onLoadedMetadata 调用） */
  function setDuration(sec: number): void {
    if (Number.isFinite(sec) && sec > 0) durationSec.value = sec
  }

  /** 播放/暂停状态同步（组件事件调用） */
  function setPlaying(v: boolean): void {
    playing.value = v
  }

  /** 播放速度 */
  function setRate(r: number): void {
    rate.value = r
  }

  /** 静音 */
  function toggleMuted(): void {
    muted.value = !muted.value
  }

  /** 跳转到某句（点转写） */
  function seekToSegment(index: number): void {
    const seg = segments.value[index]
    if (!seg) return
    currentSec.value = seg.startSec
    activeSegment.value = index
    // 发一次明确的跳转请求（播放器监听 seekSeq，而不是 activeSegment）
    seekTarget.value = seg.startSec
    seekSeq.value += 1
  }

  /** 点击转写某句的"开始秒"（给组件用的纯计算，不碰 DOM） */
  function segmentStart(index: number): number {
    return segments.value[index]?.startSec ?? 0
  }

  /** 媒体元素报错（编码不支持 / 文件损坏） */
  function setMediaError(msg: string): void {
    mediaError.value = msg
  }

  /** 离开前落一次进度 */
  async function flushProgress(): Promise<void> {
    if (progressTimer) clearTimeout(progressTimer)
    await persistProgress()
  }

  // 播放头变化 → 防抖保存进度（1.5 秒，播放中不要频繁写库）
  let progressTimer: ReturnType<typeof setTimeout> | null = null
  watch(currentSec, () => {
    if (progressTimer) clearTimeout(progressTimer)
    progressTimer = setTimeout(() => {
      void persistProgress()
    }, 1500)
  })

  return {
    // 数据
    carrier,
    source,
    transcript,
    user,
    // 播放状态
    currentSec,
    durationSec,
    playing,
    rate,
    muted,
    transcriptOpen,
    activeSegment,
    follow,
    seekSeq,
    seekTarget,
    // 流程
    loading,
    error,
    mediaError,
    // 派生
    segments,
    percent,
    playable,
    // 动作
    load,
    setCurrentSec,
    setDuration,
    setPlaying,
    setRate,
    toggleMuted,
    seekToSegment,
    segmentStart,
    setMediaError,
    flushProgress
  }
})
