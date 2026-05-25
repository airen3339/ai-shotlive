/**
 * AI Provider 管理器
 * 控制论"竞争-协同律"：
 *   - 文本默认用百炼 (DashScope)
 *   - 图像支持百炼/火山引擎切换
 *   - 视频默认用火山引擎 (Seedance)
 *   - 每种能力独立选择 provider，按需实例化
 */
import type { ModelProvider, TextAIService, ImageAIService, VideoAIService } from './types'
import { createDashScopeProvider } from './dashscope'
import { createVolcengineProvider } from './volcengine'

export type {
  TextAIService,
  ImageAIService,
  VideoAIService,
  ModelProvider,
  TextOptions,
  ImageOptions,
  VideoParams,
  TextResult,
  ImageResult,
  VideoResult,
  VideoStatus,
} from './types'

// 按能力缓存 provider 实例
let textSvc: TextAIService | null = null
let imageSvc: ImageAIService | null = null
let videoSvc: VideoAIService | null = null

/**
 * 获取文本 AI 服务（默认百炼 Qwen）
 */
export function getTextService(): TextAIService {
  if (!textSvc) {
    textSvc = createDashScopeProvider().textService
  }
  return textSvc
}

/**
 * 获取图像 AI 服务（默认百炼万相）
 */
export function getImageService(): ImageAIService {
  if (!imageSvc) {
    const cfg = require('@/config')
    const imageCfg = cfg.getConfig().image
    if (imageCfg.provider === 'volcengine') {
      imageSvc = createVolcengineProvider().imageService
    } else {
      imageSvc = createDashScopeProvider().imageService
    }
  }
  return imageSvc
}

/**
 * 获取视频 AI 服务（默认火山引擎 Seedance）
 */
export function getVideoService(): VideoAIService {
  if (!videoSvc) {
    videoSvc = createVolcengineProvider().videoService
  }
  return videoSvc
}

/**
 * 重置所有 provider 实例（配置变更时调用）
 */
export function resetProviders(): void {
  textSvc = null
  imageSvc = null
  videoSvc = null
}
