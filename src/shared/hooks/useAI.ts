/**
 * AI 调用 Hook
 * 控制论"信息-反馈律"：统一暴露 loading/error，让 UI 感知调用过程
 */
import { useCallback, useState } from 'react'
import { hasApiKey } from '@/config'
import { getAIProvider } from '@/services/ai'
import type { ImageOptions, TextOptions, VideoParams } from '@/services/ai'

function ensureApiKey() {
  if (!hasApiKey()) throw new Error('请先配置 API Key')
}

export function useTextAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: TextOptions) => {
      ensureApiKey()
      setLoading(true)
      setError(null)
      try {
        const provider = getAIProvider()
        const result = await provider.textService.generateText(prompt, options)
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
      ensureApiKey()
      setLoading(true)
      setError(null)
      try {
        const provider = getAIProvider()
        const result = await provider.imageService.generateImage(prompt, options)
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

  const submit = useCallback(async (params: VideoParams) => {
    ensureApiKey()
    setLoading(true)
    setError(null)
    try {
      const provider = getAIProvider()
      const result = await provider.videoService.generateVideo(params)
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提交失败'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const checkStatus = useCallback(async (taskId: string) => {
    ensureApiKey()
    const provider = getAIProvider()
    return provider.videoService.checkStatus(taskId)
  }, [])

  return { submit, checkStatus, loading, error }
}
