/**
 * DashScope (阿里云百炼) AI 服务适配器
 * 控制论"开放系统设计"：实现统一接口契约，封装厂商差异
 *
 * 文本：Qwen 系列（OpenAI 兼容模式，同步调用）
 * 图像：万相 wanx2.1 / FLUX 等（OpenAI 兼容模式，异步任务 + 轮询）
 * 视频：通义万相视频生成（原生 API，异步任务 + 轮询）
 */

import { getConfig } from '@/config'
import type {
  TextAIService,
  TextOptions,
  TextResult,
  ImageAIService,
  ImageOptions,
  ImageResult,
  VideoAIService,
  VideoParams,
  VideoResult,
  VideoStatus,
  ModelProvider,
} from './types'

// ===== 常量配置 =====
const COMPATIBLE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const NATIVE_BASE = 'https://dashscope.aliyuncs.com/api/v1'
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 10 * 60 * 1000 // 10 分钟
const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = 1000

// ===== 工具函数 =====
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireApiKey(key: string, section: string): string {
  if (!key) {
    throw new DashScopeError(
      `未配置 ${section} API Key，请在设置中配置百炼 API Key`,
      'AUTH_MISSING',
    )
  }
  return key
}

export class DashScopeError extends Error {
  constructor(message: string, public code: string, public status?: number) {
    super(message)
    this.name = 'DashScopeError'
  }
}

/**
 * 带重试的 fetch 包装。
 * 仅对网络错误和 5xx 进行指数退避重试；4xx 直接抛错。
 */
async function fetchWithRetry(input: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init)
      if (res.status >= 500) {
        lastErr = new DashScopeError(`服务端错误 (${res.status})`, 'SERVER_ERROR', res.status)
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
        continue
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const code =
          res.status === 401
            ? 'AUTH_INVALID'
            : res.status === 429
              ? 'QUOTA_EXCEEDED'
              : 'CLIENT_ERROR'
        const friendly =
          res.status === 401
            ? 'API Key 无效或已过期'
            : res.status === 429
              ? '请求过于频繁或配额超限，请稍后重试'
              : `请求失败 (${res.status}): ${text.slice(0, 200)}`
        throw new DashScopeError(friendly, code, res.status)
      }
      return res
    } catch (err) {
      if (err instanceof DashScopeError && err.code !== 'SERVER_ERROR') throw err
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
      }
    }
  }
  if (lastErr instanceof Error) {
    throw new DashScopeError(`网络请求失败: ${lastErr.message}`, 'NETWORK_ERROR')
  }
  throw new DashScopeError('未知的网络错误', 'NETWORK_ERROR')
}

// ===== 文本服务 =====
export class DashScopeTextService implements TextAIService {
  async generateText(prompt: string, options?: TextOptions): Promise<TextResult> {
    const cfg = getConfig().text
    const apiKey = requireApiKey(cfg.apiKey, '文本模型')
    const baseUrl = cfg.baseUrl || COMPATIBLE_BASE

    const messages: Array<{ role: string; content: string }> = []
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const body = {
      model: 'qwen-plus',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    }

    const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new DashScopeError('文本生成返回为空', 'EMPTY_RESPONSE')
    }
    return {
      content,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    }
  }
}

// ===== 图像服务 =====
export class DashScopeImageService implements ImageAIService {
  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const cfg = getConfig().image
    const apiKey = requireApiKey(cfg.apiKey, '图像模型')
    const baseUrl = cfg.baseUrl || COMPATIBLE_BASE
    const width = options?.width ?? 1024
    const height = options?.height ?? 1024

    // 使用 OpenAI 兼容模式调用图像生成
    const body = {
      model: cfg.provider === 'dashscope' ? 'wanx2.1-t2i-turbo' : 'wanx2.1-t2i-turbo',
      prompt,
      n: options?.count ?? 1,
      size: `${width}x${height}`,
      ...(options?.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    }

    const res = await fetchWithRetry(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    // OpenAI 兼容模式可能直接返回 data 数组
    if (data?.data?.[0]?.url) {
      return {
        url: data.data[0].url,
        revisedPrompt: data.data[0].revised_prompt,
      }
    }

    // 异步任务模式
    const taskId = data?.output?.task_id ?? data?.id
    if (taskId) {
      return this.pollImageTask(taskId, apiKey)
    }

    throw new DashScopeError('图像任务提交失败', 'TASK_SUBMIT_FAILED')
  }

  private async pollImageTask(taskId: string, apiKey: string): Promise<ImageResult> {
    const start = Date.now()
    while (Date.now() - start < MAX_WAIT_MS) {
      const res = await fetchWithRetry(`${NATIVE_BASE}/tasks/${taskId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const data = await res.json()
      const rawStatus = data?.output?.task_status ?? data?.status

      if (rawStatus === 'SUCCEEDED' || rawStatus === 'completed') {
        const url =
          data?.output?.results?.[0]?.url ??
          data?.output?.video_url ??
          data?.data?.[0]?.url
        if (!url) {
          throw new DashScopeError('任务完成但未返回 URL', 'EMPTY_RESPONSE')
        }
        return {
          url,
          revisedPrompt: data?.output?.results?.[0]?.actual_prompt,
        }
      }

      if (rawStatus === 'FAILED' || rawStatus === 'failed') {
        throw new DashScopeError(
          `图像任务失败: ${data?.output?.message ?? data?.message ?? '未知错误'}`,
          'TASK_FAILED',
        )
      }

      await sleep(POLL_INTERVAL_MS)
    }
    throw new DashScopeError(`图像任务超时（>${MAX_WAIT_MS / 1000}s）`, 'TASK_TIMEOUT')
  }
}

// ===== 视频服务（百炼端保留，实际主用火山引擎） =====
export class DashScopeVideoService implements VideoAIService {
  async generateVideo(params: VideoParams): Promise<VideoResult> {
    const cfg = getConfig().video
    const apiKey = requireApiKey(cfg.apiKey, '视频模型')

    const body: Record<string, unknown> = {
      model: 'wanx2.1-t2v-turbo',
      input: {
        prompt: params.prompt,
        ...(params.imageUrl ? { img_url: params.imageUrl } : {}),
      },
      parameters: {
        ...(params.duration ? { duration: params.duration } : {}),
        ...(params.aspectRatio ? { aspect_ratio: params.aspectRatio } : {}),
      },
    }

    const res = await fetchWithRetry(`${NATIVE_BASE}/services/aigc/video-generation/video-synthesis`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    const taskId = data?.output?.task_id ?? data?.id
    if (!taskId) {
      throw new DashScopeError(
        `提交异步任务失败: ${data?.message ?? '未返回 task_id'}`,
        'TASK_SUBMIT_FAILED',
      )
    }

    return {
      taskId,
      status: { state: 'pending' },
    }
  }

  async checkStatus(taskId: string): Promise<VideoStatus> {
    const cfg = getConfig().video
    const apiKey = requireApiKey(cfg.apiKey, '视频模型')

    const res = await fetchWithRetry(`${NATIVE_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    const state = mapTaskStatus(data?.output?.task_status)

    if (state === 'completed') {
      const url =
        data?.output?.video_url ??
        data?.output?.results?.[0]?.url ??
        undefined
      if (!url) {
        return { state: 'failed', error: '任务完成但未返回视频 URL' }
      }
      return { state, resultUrl: url, progress: 100 }
    }

    if (state === 'failed') {
      return {
        state,
        error: data?.output?.message ?? data?.message ?? '视频生成失败',
      }
    }

    return { state, progress: state === 'processing' ? 50 : 0 }
  }
}

function mapTaskStatus(raw: string | undefined): VideoStatus['state'] {
  switch (raw) {
    case 'PENDING':
      return 'pending'
    case 'RUNNING':
      return 'processing'
    case 'SUCCEEDED':
      return 'completed'
    case 'FAILED':
    case 'CANCELED':
    case 'UNKNOWN':
      return 'failed'
    default:
      return 'pending'
  }
}

// ===== Provider 工厂 =====
export function createDashScopeProvider(): ModelProvider {
  return {
    id: 'dashscope',
    name: '百炼 (DashScope)',
    textService: new DashScopeTextService(),
    imageService: new DashScopeImageService(),
    videoService: new DashScopeVideoService(),
  }
}
