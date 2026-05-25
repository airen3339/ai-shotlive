/**
 * 应用配置
 * 控制论"开放系统"：配置驱动，不硬编码
 *
 * 支持多模型提供商分别配置：
 *   - 文本模型：百炼 (DashScope OpenAI 兼容)
 *   - 图像模型：百炼万相 / 火山引擎 Seedream
 *   - 视频模型：火山引擎 Seedance
 */

export type ModelProvider = 'dashscope' | 'volcengine'

export interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  baseUrl?: string       // OpenAI 兼容模式用
  endpointId?: string    // 火山引擎接入点 ID
  region?: string        // 火山引擎区域
}

export interface AppConfig {
  text: ModelConfig
  image: ModelConfig
  video: ModelConfig
}

const DEFAULT_CONFIG: AppConfig = {
  text: {
    provider: 'dashscope',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  image: {
    provider: 'dashscope',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  video: {
    provider: 'volcengine',
    apiKey: '',
    endpointId: '',
    region: 'cn-beijing',
  },
}

let currentConfig: AppConfig = {
  text: { ...DEFAULT_CONFIG.text },
  image: { ...DEFAULT_CONFIG.image },
  video: { ...DEFAULT_CONFIG.video },
}

export function getConfig(): AppConfig {
  return { ...currentConfig }
}

export function setConfig(config: Partial<AppConfig>): void {
  if (config.text) currentConfig.text = { ...currentConfig.text, ...config.text }
  if (config.image) currentConfig.image = { ...currentConfig.image, ...config.image }
  if (config.video) currentConfig.video = { ...currentConfig.video, ...config.video }
}

export function hasApiKeyFor(provider: 'text' | 'image' | 'video'): boolean {
  return currentConfig[provider].apiKey.length > 0
}

export function hasAnyApiKey(): boolean {
  return hasApiKeyFor('text') || hasApiKeyFor('image') || hasApiKeyFor('video')
}

export function setModelConfig(section: 'text' | 'image' | 'video', config: Partial<ModelConfig>): void {
  currentConfig[section] = { ...currentConfig[section], ...config }
}
