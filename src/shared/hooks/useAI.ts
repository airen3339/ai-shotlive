/**
 * AI 调用 Hook — 纯客户端渲染，所有 AI 调用通过服务端代理
 *
 * 控制论"信息-反馈律"：
 *   客户端提交任务 → 服务端执行 AI → 结果返回客户端
 *   断连不影响服务端任务，重连后可查询状态
 */
import { useCallback, useState } from 'react'
import { ai } from '@/api/client'
import type { TextOptions, ImageOptions, VideoParams } from '@/providers/types'

// ===== 文本 AI =====
export function useTextAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: TextOptions) => {
      setLoading(true)
      setError(null)
      try {
        const result = await ai.chat({
          prompt,
          systemPrompt: options?.systemPrompt,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
        })
        return result.content
      } catch (e) {
        const msg = e instanceof Error ? e.message : '生成失败'
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { generate, loading, error }
}

// ===== 图像 AI =====
export function useImageAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: ImageOptions) => {
      setLoading(true)
      setError(null)
      try {
        const result = await ai.image({
          prompt,
          width: options?.width,
          height: options?.height,
          negativePrompt: options?.negativePrompt,
        })
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : '生成失败'
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { generate, loading, error }
}

// ===== 视频 AI =====
export function useVideoAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (params: VideoParams) => {
      setLoading(true)
      setError(null)
      try {
        const result = await ai.video({
          prompt: params.prompt,
          imageUrl: params.imageUrl,
          endImageUrl: params.endImageUrl,
          duration: params.duration,
          aspectRatio: params.aspectRatio,
        })
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : '提交失败'
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const checkStatus = useCallback(async (taskId: string) => {
    const result = await ai.videoStatus(taskId)
    return {
      state: result.status as 'pending' | 'processing' | 'completed' | 'failed',
      progress: result.progress,
      resultUrl: result.resultUrl,
      error: result.error,
    }
  }, [])

  return { submit, checkStatus, loading, error }
}
