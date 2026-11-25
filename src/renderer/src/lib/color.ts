/**
 * 节点颜色映射纯函数（Color Mapping）。
 *
 * 技术树节点有两种配色方案（对应"双模式可插拔"宪法，设置页可切）：
 * - layer：按 L0-L6 七层各一色（默认）。
 * - ember：统一火种琥珀系（单色，靠明暗区分主次）。
 *
 * 关键：这里读的是 CSS 变量值（因为画布是 Canvas，不继承 DOM 的 CSS 变量，
 * 需要运行时从根节点读出当前主题下的实际色值）。
 */

import { layerOf } from '@/types/layer'

/** 配色方案 */
export type TechTreeColorScheme = 'layer' | 'ember'

/**
 * 从根节点读一个 CSS 变量的实际值（Canvas 不继承 CSS 变量，需运行时手动读）。
 * 导出供图库适配器复用：主题切换后画布内颜色不会自动更新，需重新渲染时重读。
 */
export function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 七层色的 CSS 变量名（按层号） */
const LAYER_VARS = [
  '--layer-0',
  '--layer-1',
  '--layer-2',
  '--layer-3',
  '--layer-4',
  '--layer-5',
  '--layer-6'
] as const

/** 各层色的兜底值（防止 CSS 变量未加载） */
const LAYER_FALLBACKS = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#9333ea'
] as const

/**
 * 按配色方案取节点主色。
 *
 * @param layer 层号 0-6
 * @param scheme 配色方案
 * @returns 十六进制颜色
 */
export function nodeColor(layer: number, scheme: TechTreeColorScheme): string {
  if (scheme === 'ember') {
    // 琥珀系：用明暗区分层，越底层越深、越高层越亮
    const emberShades = [
      readCssVar('--ember-600', '#b45309'),
      readCssVar('--ember-500', '#d97706'),
      readCssVar('--ember-400', '#f59e0b'),
      readCssVar('--ember-300', '#fbbf24'),
      readCssVar('--ember-300', '#fbbf24'),
      readCssVar('--ember-300', '#fbbf24'),
      readCssVar('--ember-300', '#fbbf24')
    ]
    return emberShades[layer] ?? emberShades[0]
  }
  // 默认按层七色
  return readCssVar(LAYER_VARS[layer] ?? '--layer-0', LAYER_FALLBACKS[layer] ?? LAYER_FALLBACKS[0])
}

/**
 * 取某层的显示名（用于图例/详情）。
 * @param layer 层号
 * @returns 层中文名
 */
export function layerName(layer: number): string {
  return layerOf(layer as 0 | 1 | 2 | 3 | 4 | 5 | 6).name
}
