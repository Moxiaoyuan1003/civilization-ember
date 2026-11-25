/**
 * 应用设置服务接口（Settings Service）。
 *
 * 管理"整机级设置"（AI / 转写 / 存储）的读写。
 * 真实实现会落到本机配置文件（如 %APPDATA%/CivilizationEmber/settings.json），
 * 与个人偏好（数据库里的 per-user 行）分开存。
 */

import type { AppSettings } from '@/types/settings'

export interface SettingsService {
  /** 读取整机设置（无则返回默认值） */
  getSettings(): Promise<AppSettings>
  /** 保存整机设置 */
  saveSettings(settings: AppSettings): Promise<void>
  /**
   * 测试 AI 接线是否可用（发一个最小请求）。
   * @returns 成功返回 true 与提示语；失败返回 false 与原因
   */
  testAi(): Promise<{ ok: boolean; message: string }>
  /** 校验存储目录是否存在且可写 */
  testStoragePath(path: string): Promise<{ ok: boolean; message: string }>
}
