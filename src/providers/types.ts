export type ProviderCapability = 'text' | 'image' | 'video'

export interface TextOptions { temperature?: number; maxTokens?: number; systemPrompt?: string }
export interface TextResult { content: string; usage?: { promptTokens: number; completionTokens: number } }
export interface TextAIService { generateText(prompt: string, options?: TextOptions): Promise<TextResult> }

export interface ImageOptions { width?: number; height?: number; negativePrompt?: string; count?: number }
export interface ImageResult { url: string; revisedPrompt?: string }
export interface ImageAIService { generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> }

export interface VideoParams { prompt: string; imageUrl?: string; endImageUrl?: string; duration?: number; aspectRatio?: string }
export interface VideoStatus { state: 'pending' | 'processing' | 'completed' | 'failed'; progress?: number; resultUrl?: string; error?: string }
export interface VideoResult { taskId: string; status: VideoStatus }
export interface VideoAIService { generateVideo(params: VideoParams): Promise<VideoResult>; checkStatus(taskId: string): Promise<VideoStatus> }

export interface ProviderCapabilityMap { text?: TextAIService; image?: ImageAIService; video?: VideoAIService }
export interface AIProvider { id: string; name: string; services: ProviderCapabilityMap }

export interface CustomProviderConfig {
  id: string; name: string; baseUrl: string; apiKey: string;
  capabilities: ProviderCapability[]; models?: Partial<Record<ProviderCapability, string>>
}
export interface CapabilityRoute { textProviderId: string; imageProviderId: string; videoProviderId: string }
