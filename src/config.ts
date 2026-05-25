/**
 * 应用配置
 * 控制论"开放系统"：配置驱动，不硬编码
 */

export interface AppConfig {
  ai: {
    apiKey: string
    baseUrl: string
    textModel: string
    imageModel: string
    videoModel: string
  }
}

const DEFAULT_CONFIG: AppConfig = {
  ai: {
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    textModel: 'qwen-plus',
    imageModel: 'wanx-v1',
    videoModel: 'wanx-video-v1',
  },
}

let currentConfig: AppConfig = { ...DEFAULT_CONFIG, ai: { ...DEFAULT_CONFIG.ai } }

export function getConfig(): AppConfig {
  return currentConfig
}

export function setConfig(config: Partial<AppConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    ai: { ...currentConfig.ai, ...(config.ai ?? {}) },
  }
}

export function setApiKey(key: string): void {
  currentConfig.ai.apiKey = key
}

export function hasApiKey(): boolean {
  return currentConfig.ai.apiKey.length > 0
}
