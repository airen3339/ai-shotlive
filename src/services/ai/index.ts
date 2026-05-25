/**
 * AI Provider管理器
 * 控制论"竞争-协同律"：当前只有一个Provider，但架构支持未来多Provider切换
 */
import type { ModelProvider } from './types'
import { createDashScopeProvider } from './dashscope'

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

let provider: ModelProvider | null = null

export function getAIProvider(): ModelProvider {
  if (!provider) {
    provider = createDashScopeProvider()
  }
  return provider
}

export function resetProvider(): void {
  provider = null
}
