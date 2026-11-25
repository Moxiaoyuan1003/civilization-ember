/**
 * 应用级设置（AppSettings）类型定义。
 *
 * 与"个人偏好（UserPreferences）"的分界线（重要，是数据模型的一部分）：
 * - **个人偏好**：主题、视图形态、模块开关、首页卡片布局——"这个人怎么用"。
 * - **应用设置**：AI 模型接哪个、转写引擎用哪个、数据存哪个目录——"这台机器怎么跑"。
 *
 * 为什么分开：AI/转写/存储是**整机级**的，一个 NAS 上多用户共用同一套模型与磁盘；
 * 把 API Key、模型路径塞进个人偏好，会导致"每换个用户都要重配一遍"。
 * 两者都落库，但语义不同、将来迁移策略也不同（整机设置可导出配置文件分发）。
 */

/** AI 接线设置（先用云端 API 跑通逻辑，之后再换本地模型） */
export interface AiSettings {
  /** 提供方：mock（本地假实现）/ cloud（云端 API）/ local（本地模型） */
  provider: 'mock' | 'cloud' | 'local'
  /** API 基址（cloud/local 用，兼容 OpenAI 协议的服务都填这里） */
  baseUrl: string
  /** 模型名（如 deepseek-chat / qwen2.5:14b） */
  model: string
  /** 温度（0-1，越低越稳） */
  temperature: number
  /**
   * API Key。
   * 注意：真实实现应存入系统密钥库（Windows Credential Manager / keytar），
   * 这里明文仅用于本地演示，接入时替换为"是否已配置 + 掩码显示"。
   */
  apiKey: string
}

/** 视频/音频转写设置（本地 Whisper 为主，可插拔换引擎） */
export interface TranscriptionSettings {
  /** 转写引擎（可插拔） */
  engine: 'openai-whisper' | 'faster-whisper' | 'whisper.cpp' | 'funasr' | 'sensevoice'
  /** 算力设备：显卡 / CPU */
  device: 'cuda' | 'cpu'
  /** 识别语言：自动 / 中文 / 英文 */
  language: 'auto' | 'zh' | 'en'
  /** 模型规格（越大越准越慢） */
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large'
}

/** 存储设置（数据放哪、要不要盯文件夹自动入库） */
export interface StorageSettings {
  /** 原始载体存放目录 */
  dataDir: string
  /** 索引/中间产物目录 */
  indexDir: string
  /** 监控文件夹（NAS 丢进这里自动入库） */
  watchFolder: string
  /** 是否开启文件夹监控自动导入 */
  watchEnabled: boolean
}

/** 应用级设置总集 */
export interface AppSettings {
  ai: AiSettings
  transcription: TranscriptionSettings
  storage: StorageSettings
}

/** 默认应用设置（首次启动） */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  ai: {
    provider: 'mock',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 0.6,
    apiKey: ''
  },
  transcription: {
    engine: 'faster-whisper',
    device: 'cuda',
    language: 'auto',
    modelSize: 'medium'
  },
  storage: {
    dataDir: 'D:\\CivilizationEmber\\data',
    indexDir: 'D:\\CivilizationEmber\\index',
    watchFolder: 'D:\\CivilizationEmber\\inbox',
    watchEnabled: false
  }
}

/** AI 提供方的中文名（UI 下拉用） */
export const AI_PROVIDERS: { value: AiSettings['provider']; label: string; desc: string }[] = [
  { value: 'mock', label: '本地假实现', desc: '不联网，返回预置话术，用于跑通界面' },
  { value: 'cloud', label: '云端 API', desc: '兼容 OpenAI 协议的服务（DeepSeek / 通义等）' },
  { value: 'local', label: '本地模型', desc: 'Ollama / vLLM 等本机推理服务' }
]

/** 转写引擎的中文名与说明（UI 下拉用） */
export const TRANSCRIPTION_ENGINES: {
  value: TranscriptionSettings['engine']
  label: string
  desc: string
}[] = [
  { value: 'faster-whisper', label: 'faster-whisper', desc: '推荐：速度快、显存占用低' },
  { value: 'openai-whisper', label: 'openai-whisper', desc: '官方实现，兼容性最好' },
  { value: 'whisper.cpp', label: 'whisper.cpp', desc: '纯 CPU 可跑，适合没显卡的机器' },
  { value: 'funasr', label: 'FunASR', desc: '阿里出品，中文识别准确' },
  { value: 'sensevoice', label: 'SenseVoice', desc: '阿里出品，多语言 + 情绪识别' }
]
