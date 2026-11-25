/**
 * 视频/音频载体的"媒体来源"类型定义。
 *
 * 为什么要有这一层：火种里的音视频可能来自三种地方——
 * 1. 本地文件（摄取层拷进 data 目录，路径可读）；
 * 2. 还没入库的网络地址（网页视频，先流式试试）；
 * 3. 只有转写、没有原文件（原片丢了，但文字留下来了）。
 *
 * 播放器必须把这三种情况都表达出来，不能假设"一定有能播的文件"。
 * 第 3 种恰恰是文明断层场景里最真实的一种：**载体丢了，知识还在**。
 */

import type { CarrierType } from './carrier'

/** 媒体来源种类 */
export type MediaSourceKind = 'local' | 'remote' | 'transcript-only'

/** 播放器解析出的播放源 */
export interface MediaSource {
  /** 来源种类 */
  kind: MediaSourceKind
  /** 可播放地址（local 为 file:// 或应用内相对路径，remote 为 http(s)） */
  src?: string
  /** 这个载体是视频还是音频（决定用 <video> 还是 <audio>） */
  mediaType: Extract<CarrierType, 'video' | 'audio'>
  /** 说明文案：给用户解释"为什么是这个状态" */
  note: string
}
