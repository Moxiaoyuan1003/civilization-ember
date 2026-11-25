/**
 * 格式化工具（纯函数，无副作用）。
 *
 * 放在 lib/ 是因为它们不碰状态、不碰组件，任何地方都能复用。
 */

/**
 * 字节数 → 人类可读大小（如 1.24 GB）。
 * @param bytes 字节数
 * @param digits 小数位，默认 1
 */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  // 字节单位不带小数
  return `${i === 0 ? value.toFixed(0) : value.toFixed(digits)} ${units[i]}`
}

/**
 * 秒数 → 时长文本（如 1:23:45 / 12:30）。
 * @param seconds 秒
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * ISO 时间串 → 本地相对时间（如 "3 分钟前"）。
 * 超过 30 天则显示日期。
 */
export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

/** 百分比文本（0.42 → "42%"） */
export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '0%'
  return `${(ratio * 100).toFixed(digits)}%`
}
