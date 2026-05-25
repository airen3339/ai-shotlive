/**
 * Volcengine (火山引擎) AI 服务适配器
 * 控制论"开放系统设计"：封装厂商差异，实现统一接口契约
 *
 * 图像：doubao-seedream-4-5-251128（异步任务 + 轮询）
 * 视频：doubao-seedance-1-5-pro-251215（异步任务 + 轮询）
 * 文本：不使用火山引擎（默认用百炼 Qwen）
 *
 * API 文档参考：
 *   https://www.volcengine.com/docs/6791/1399568
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
const API_HOST = 'visual.volcengineapi.com'
const SERVICE_VERSION = '2024-11-15'
const POLL_INTERVAL_MS = 5000
const MAX_WAIT_MS = 15 * 60 * 1000 // 15 分钟
const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = 1000

// ===== 工具函数 =====
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireVolcKey(): { apiKey: string; endpointId: string } {
  const cfg = getConfig().video
  if (!cfg.apiKey) {
    throw new VolcengineError('未配置火山引擎 API Key', 'AUTH_MISSING')
  }
  return { apiKey: cfg.apiKey, endpointId: cfg.endpointId || '' }
}

export class VolcengineError extends Error {
  constructor(message: string, public code: string, public status?: number) {
    super(message)
    this.name = 'VolcengineError'
  }
}

/**
 * 火山引擎 OpenAPI 签名辅助
 * 简化版：使用 API Key 作为 Bearer Token 的认证方式
 */
async function volcFetch(
  action: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const cfg = getConfig()
  const { apiKey, endpointId } = {
    apiKey: cfg.video.apiKey,
    endpointId: cfg.video.endpointId || '',
  }

  if (!apiKey) {
    throw new VolcengineError('未配置火山引擎 API Key', 'AUTH_MISSING')
  }

  // 使用火山引擎的 API Key 认证方式（Bearer Token）
  // Endpoint ID 用于指定具体的模型接入点
  const url = `https://${API_HOST}/?Action=${action}&Version=${SERVICE_VERSION}${endpointId ? `&EndpointId=${encodeURIComponent(endpointId)}` : ''}`

  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (res.status >= 500) {
        lastErr = new VolcengineError(`服务端错误 (${res.status})`, 'SERVER_ERROR', res.status)
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
        continue
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const code =
          res.status === 401 ? 'AUTH_INVALID' : res.status === 429 ? 'QUOTA_EXCEEDED' : 'CLIENT_ERROR'
        throw new VolcengineError(
          `请求失败 (${res.status}): ${text.slice(0, 200)}`,
          code,
          res.status,
        )
      }
      return res
    } catch (err) {
      if (err instanceof VolcengineError && err.code !== 'SERVER_ERROR') throw err
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
      }
    }
  }

  if (lastErr instanceof Error) {
    throw new VolcengineError(`网络请求失败: ${lastErr.message}`, 'NETWORK_ERROR')
  }
  throw new VolcengineError('未知的网络错误', 'NETWORK_ERROR')
}

// ===== 文本服务（火山引擎不提供文本服务，返回空实现） =====
export class VolcengineTextService implements TextAIService {
  async generateText(_prompt: string, _options?: TextOptions): Promise<TextResult> {
    throw new VolcengineError('火山引擎不提供文本生成服务，请使用百炼 Qwen 模型', 'NOT_SUPPORTED')
  }
}

// ===== 图像服务：doubao-seedream-4-5 =====
export class VolcengineImageService implements ImageAIService {
  async generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
    const cfg = getConfig()
    const apiKey = cfg.image.apiKey
    const endpointId = cfg.image.endpointId

    if (!apiKey) {
      throw new VolcengineError('未配置火山引擎图像 API Key', 'AUTH_MISSING')
    }

    const width = options?.width ?? 1024
    const height = options?.height ?? 1024

    // 计算宽高比
    const aspectRatio = computeAspectRatio(width, height)

    const body: Record<string, unknown> = {
      req_key: 'img2img_seedream',
      prompt,
      ...(options?.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      width,
      height,
      model_version: 'doubao-seedream-4-5-251128',
      seed: Math.floor(Math.random() * 2 ** 31),
    }

    // 通过视觉服务 API 提交图像任务
    const url = `https://${API_HOST}/?Action=CVProcess&Version=2022-08-31${endpointId ? `&EndpointId=${encodeURIComponent(endpointId)}` : ''}`

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    // 火山引擎图像 API 返回格式
    if (data?.data?.image_urls?.[0]) {
      return {
        url: data.data.image_urls[0],
        revisedPrompt: data.data.revised_prompt ?? prompt,
      }
    }

    // 兼容另一种返回格式
    if (data?.data?.binary_data_base64?.[0]) {
      const base64 = data.data.binary_data_base64[0]
      const blobUrl = `data:image/png;base64,${base64}`
      return { url: blobUrl, revisedPrompt: prompt }
    }

    if (data?.code && data.code !== 10000) {
      throw new VolcengineError(
        `图像生成失败: ${data.message ?? data.req_id ?? '未知错误'}`,
        'TASK_FAILED',
      )
    }

    throw new VolcengineError('图像任务返回格式异常', 'EMPTY_RESPONSE')
  }
}

// ===== 视频服务：doubao-seedance-1-5-pro =====
export class VolcengineVideoService implements VideoAIService {
  /**
   * 提交视频生成任务
   * 使用火山引擎视觉智能 API
   */
  async generateVideo(params: VideoParams): Promise<VideoResult> {
    const cfg = getConfig()
    const apiKey = cfg.video.apiKey
    const endpointId = cfg.video.endpointId

    if (!apiKey) {
      throw new VolcengineError('未配置火山引擎视频 API Key', 'AUTH_MISSING')
    }

    // 使用 OpenAI 兼容模式提交 Seedance 任务
    // 文档: https://www.volcengine.com/docs/6791/1399568
    const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3'
    const body = {
      model: 'doubao-seedance-1-5-pro-251215',
      prompt: params.prompt,
      ...(params.imageUrl ? { image_urls: [params.imageUrl] } : {}),
      ...(params.endImageUrl ? { image_urls: [params.imageUrl ?? '', params.endImageUrl] } : {}),
      duration: params.duration ?? 5,
      ...(params.aspectRatio ? { ratio: params.aspectRatio } : {}),
      ...(endpointId ? { endpoint_id: endpointId } : {}),
    }

    const res = await fetchWithRetry(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    const taskId = data?.id ?? data?.output?.task_id

    if (!taskId) {
      throw new VolcengineError(
        `提交视频任务失败: ${data?.error?.message ?? data?.message ?? '未返回任务ID'}`,
        'TASK_SUBMIT_FAILED',
      )
    }

    return {
      taskId,
      status: { state: 'pending' },
    }
  }

  /**
   * 查询视频任务状态
   */
  async checkStatus(taskId: string): Promise<VideoStatus> {
    const cfg = getConfig()
    const apiKey = cfg.video.apiKey

    if (!apiKey) {
      throw new VolcengineError('未配置火山引擎 API Key', 'AUTH_MISSING')
    }

    const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3'

    const res = await fetchWithRetry(`${baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    const data = await res.json()
    const state = mapVolcTaskStatus(data?.status)

    if (state === 'completed') {
      const url =
        data?.output?.video_url ??
        data?.data?.[0]?.url ??
        data?.result?.video_url ??
        undefined
      if (!url) {
        return { state: 'failed', error: '任务完成但未返回视频 URL' }
      }
      return { state, resultUrl: url, progress: 100 }
    }

    if (state === 'failed') {
      return {
        state,
        error: data?.error?.message ?? data?.status_details ?? '视频生成失败',
      }
    }

    // 从 status 中提取进度
    const progress = state === 'processing' ? extractProgress(data) : undefined
    return { state, progress }
  }
}

function mapVolcTaskStatus(raw: string | undefined): VideoStatus['state'] {
  switch (raw) {
    case 'queued':
    case 'pending':
    case 'in_queue':
      return 'pending'
    case 'running':
    case 'processing':
      return 'processing'
    case 'succeeded':
    case 'completed':
    case 'success':
      return 'completed'
    case 'failed':
    case 'cancelled':
    case 'canceled':
      return 'failed'
    default:
      return 'pending'
  }
}

function extractProgress(data: Record<string, unknown>): number | undefined {
  // 尝试从多种字段名中提取进度
  const raw =
    (data?.progress as number | undefined) ??
    ((data?.status_details as Record<string, unknown>)?.progress as number | undefined) ??
    ((data?.output as Record<string, unknown>)?.progress as number | undefined)
  if (typeof raw === 'number' && raw >= 0 && raw <= 100) {
    return Math.round(raw)
  }
  return undefined
}

function computeAspectRatio(width: number, height: number): string {
  const ratio = width / height
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16'
  if (Math.abs(ratio - 1) < 0.1) return '1:1'
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3'
  return `${width}:${height}`
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.status >= 500) {
        lastErr = new VolcengineError(`服务端错误 (${res.status})`, 'SERVER_ERROR', res.status)
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
        continue
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const code =
          res.status === 401 ? 'AUTH_INVALID' : res.status === 429 ? 'QUOTA_EXCEEDED' : 'CLIENT_ERROR'
        throw new VolcengineError(
          `请求失败 (${res.status}): ${text.slice(0, 200)}`,
          code,
          res.status,
        )
      }
      return res
    } catch (err) {
      if (err instanceof VolcengineError && err.code !== 'SERVER_ERROR') throw err
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, attempt))
      }
    }
  }
  if (lastErr instanceof Error) {
    throw new VolcengineError(`网络请求失败: ${lastErr.message}`, 'NETWORK_ERROR')
  }
  throw new VolcengineError('未知的网络错误', 'NETWORK_ERROR')
}

// ===== Provider 工厂 =====
export function createVolcengineProvider(): ModelProvider {
  return {
    id: 'volcengine',
    name: '火山引擎 (Volcengine)',
    textService: new VolcengineTextService(),
    imageService: new VolcengineImageService(),
    videoService: new VolcengineVideoService(),
  }
}
