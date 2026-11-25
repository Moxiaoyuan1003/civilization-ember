/**
 * 载体类型 → UI 元信息（中文名 + 图标）映射。
 *
 * 供图书馆页的卡片 / 列表行 / 详情面板共用，避免三处重复写 switch。
 * 图标是组件层的概念，所以放在 components 目录而非 lib（纯函数层）。
 */

import { BookOpen, Video, Headphones, Image, Globe } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { CarrierType } from '@/types/carrier'

/** 载体类型的展示元信息 */
export interface CarrierTypeMeta {
  /** 中文名 */
  label: string
  /** 图标组件 */
  icon: Component
  /** 封面占位底色（用于无 coverUrl 时生成"类型图标+标题"的占位封面） */
  color: string
}

/** 类型 → 元信息 */
const MAP: Record<CarrierType, CarrierTypeMeta> = {
  book: { label: '书', icon: BookOpen, color: '#b45309' },
  video: { label: '视频', icon: Video, color: '#1d4ed8' },
  audio: { label: '音频', icon: Headphones, color: '#0e7490' },
  image: { label: '图片', icon: Image, color: '#6d28d9' },
  webpage: { label: '网页', icon: Globe, color: '#065f46' }
}

/** 取某载体类型的元信息 */
export function carrierTypeMeta(type: CarrierType): CarrierTypeMeta {
  return MAP[type]
}

/** 全部载体类型（过滤栏/入库类型选择用） */
export const CARRIER_TYPES: CarrierType[] = ['book', 'video', 'audio', 'image', 'webpage']
