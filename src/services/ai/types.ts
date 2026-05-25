/**
 * AI服务统一接口定义
 * 控制论"开放系统设计"：面向抽象编程，不绑定特定厂商
 */

// ===== 文本AI服务 =====
export interface TextOptions {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface TextResult {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export interface TextAIService {
  generateText(prompt: string, options?: TextOptions): Promise<TextResult>
}

// ===== 图像AI服务 =====
export interface ImageOptions {
  width?: number
  height?: number
  style?: string
  negativePrompt?: string
  count?: number
}

export interface ImageResult {
  url: string
  revisedPrompt?: string
}

export interface ImageAIService {
  generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult>
}

// ===== 视频AI服务 =====
export interface VideoParams {
  prompt: string
  imageUrl?: string       // 图生视频的参考图
  endImageUrl?: string    // 首尾帧插值用的尾帧
  duration?: number       // 秒
  aspectRatio?: string    // "16:9" | "9:16" | "1:1"
}

export interface VideoStatus {
  state: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number       // 0-100
  resultUrl?: string
  error?: string
}

export interface VideoResult {
  taskId: string
  status: VideoStatus
}

export interface VideoAIService {
  generateVideo(params: VideoParams): Promise<VideoResult>
  checkStatus(taskId: string): Promise<VideoStatus>
}

// ===== 模型提供商 =====
export interface ModelProvider {
  id: string
  name: string
  textService: TextAIService
  imageService: ImageAIService
  videoService: VideoAIService
}
