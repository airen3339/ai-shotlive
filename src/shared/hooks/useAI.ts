/**
 * AI 调用 Hook
 * 控制论"信息-反馈律"：统一暴露 loading/error，让 UI 感知调用过程
 *
 * 每种 AI 能力（文本/图像/视频）独立调用各自的 provider 服务。
 */
import { useCallback, useState } from 'react'
import { hasApiKeyFor } from '@/config'
import { getTextService, getImageService, getVideoService, resetProviders } from '@/services/ai'
import type { ImageOptions, TextOptions, VideoParams } from '@/services/ai'

export { resetProviders }

function ensureKey(section: 'text' | 'image' | 'video') {
  if (!hasApiKeyFor(section)) throw new Error(`请先配置 ${section === 'text' ? '文本' : section === 'image' ? '图像' : '视频'} API Key`)
}

export function useTextAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: TextOptions) => {
      ensureKey('text')
      setLoading(true)
      setError(null)
      try {
        const result = await getTextService().generateText(prompt, options)
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

export function useImageAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: ImageOptions) => {
      ensureKey('image')
      setLoading(true)
      setError(null)
      try {
        const result = await getImageService().generateImage(prompt, options)
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

export function useVideoAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (params: VideoParams) => {
      ensureKey('video')
      setLoading(true)
      setError(null)
      try {
        const result = await getVideoService().generateVideo(params)
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
    return getVideoService().checkStatus(taskId)
  }, [])

  return { submit, checkStatus, loading, error }
}
