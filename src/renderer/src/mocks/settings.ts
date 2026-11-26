/**
 * Mock 应用设置服务（内存实现）。
 *
 * 设置存在内存变量里（刷新即恢复默认），演示用。
 * 真实实现会读写本机配置文件，并把 API Key 存进系统密钥库。
 */

import type { SettingsService } from '@/services/settings'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_APP_SETTINGS } from '@shared/types/settings'

export function createMockSettings(): SettingsService {
  // 可变副本：保存后同一会话内生效
  let settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS)

  return {
    async getSettings(): Promise<AppSettings> {
      return structuredClone(settings)
    },

    async saveSettings(next: AppSettings): Promise<void> {
      settings = structuredClone(next)
    },

    async testAi(): Promise<{ ok: boolean; message: string }> {
      // 模拟测试：按提供方给出不同结果
      if (settings.ai.provider === 'mock') {
        return { ok: true, message: '本地假实现可用（不联网，返回预置回答）' }
      }
      if (!settings.ai.apiKey.trim()) {
        return { ok: false, message: '未填写 API Key，无法连接云端服务' }
      }
      if (settings.ai.provider === 'cloud') {
        return {
          ok: true,
          message: `已配置云端服务：${settings.ai.baseUrl}（模型 ${settings.ai.model}）`
        }
      }
      return {
        ok: true,
        message: `已配置本地模型：${settings.ai.baseUrl}（模型 ${settings.ai.model}）`
      }
    },

    async testStoragePath(path: string): Promise<{ ok: boolean; message: string }> {
      if (!path.trim()) return { ok: false, message: '路径不能为空' }
      // 演示：只要路径看起来像绝对路径就通过
      if (!/^[A-Za-z]:[\\/]/.test(path) && !path.startsWith('/')) {
        return { ok: false, message: '请填写完整路径（如 D:\\CivilizationEmber\\data）' }
      }
      return { ok: true, message: '路径格式有效（真实实现会检查存在性与写权限）' }
    }
  }
}
