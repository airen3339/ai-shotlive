/**
 * API Client — 前后端通信层（纯 HTTP，无 IndexedDB）
 *
 * 控制论"开放系统"：
 *   - 所有数据操作通过 API
 *   - JWT token 自动附加
 *   - 401 自动清除 token
 */

const API = '/api'

let authToken: string | null = null

function saveToken(token: string) {
  authToken = token
  try { localStorage.setItem('token', token) } catch {}
}

function loadToken(): string | null {
  if (authToken) return authToken
  try { authToken = localStorage.getItem('token') } catch {}
  return authToken
}

export function getAuthToken(): string | null { return loadToken() }
export function setToken(t: string | null) {
  authToken = t
  if (t) saveToken(t)
  else try { localStorage.removeItem('token') } catch {}
}

interface ApiError extends Error { status: number; code: string }

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = loadToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${API}${path}`, { ...opts, headers })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const err: ApiError = new Error(data?.error || `请求失败 (${res.status})`) as ApiError
    err.status = res.status
    err.code = data?.code || 'UNKNOWN'
    if (res.status === 401) {
      setToken(null)
      window.dispatchEvent(new CustomEvent('auth:invalid'))
    }
    throw err
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ===== Auth =====
export const auth = {
  register: (u: string, p: string) =>
    request<{ token: string; user: { id: number; username: string } }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username: u, password: p }),
    }),
  login: (u: string, p: string) =>
    request<{ token: string; user: { id: number; username: string } }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username: u, password: p }),
    }),
  me: () =>
    request<{ user: { id: number; username: string } }>('/auth/me'),
}

// ===== Projects =====
export const projects = {
  list: () =>
    request<Array<{ id: string; title: string; stage: string; updatedAt: number; createdAt: number }>>('/projects'),
  get: (id: string) =>
    request<Record<string, unknown>>(`/projects/${id}`),
  save: (id: string, data: Record<string, unknown>) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
}

// ===== AI Config (服务端存储) =====
export type AiConfig = {
  dashscope: { apiKey: string; baseUrl?: string; textModel?: string; imageModel?: string }
  volcengine: { apiKey: string; endpointId?: string; imageModel?: string; videoModel?: string }
  custom: Array<{ id: string; name: string; baseUrl: string; apiKey: string; capabilities: Array<'text' | 'image' | 'video'> }>
  routes: { textProviderId: string; imageProviderId: string; videoProviderId: string }
}

export const aiConfig = {
  get: () =>
    request<AiConfig | null>('/models/registry'),
  save: (config: AiConfig) =>
    request<{ success: boolean }>('/models/registry', { method: 'PUT', body: JSON.stringify(config) }),
}

// ===== AI Calls (服务端代理执行) =====
export const ai = {
  chat: (body: { prompt: string; systemPrompt?: string; temperature?: number; maxTokens?: number }) =>
    request<{ content: string }>('/ai/proxy/chat', { method: 'POST', body: JSON.stringify(body) }),
  image: (body: { prompt: string; width?: number; height?: number; negativePrompt?: string; projectId?: string; episodeId?: string; entityType?: string; entityId?: string }) =>
    request<{ url: string }>('/ai/proxy/image', { method: 'POST', body: JSON.stringify(body) }),
  video: (body: { prompt: string; imageUrl?: string; endImageUrl?: string; duration?: number; aspectRatio?: string; projectId?: string; episodeId?: string }) =>
    request<{ taskId: string; status: string }>('/ai/proxy/video', { method: 'POST', body: JSON.stringify(body) }),
  videoStatus: (taskId: string) =>
    request<{ taskId: string; status: string; progress?: number; resultUrl?: string; error?: string }>(`/ai/proxy/status/${taskId}`),
}

// ===== Novel (小说与剧本管理) =====
export type NovelChapter = {
  chapterNumber: number; title: string; content: string; wordCount: number; startLine: number; endLine: number;
}
export type NovelParseResult = {
  filename?: string; filePath: string; title: string; totalWords: number;
  chapters: NovelChapter[]; parseErrors: string[];
}
export type NovelGenerateResult = {
  range: string; episodeTitle: string; script: any; rawContent: string;
}

export const novel = {
  upload: async (file: File): Promise<NovelParseResult> => {
    const token = loadToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/novel/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err: any = new Error(data?.error || `上传失败 (${res.status})`)
      err.status = res.status
      throw err
    }
    return res.json()
  },
  parse: (filePath: string) =>
    request<NovelParseResult>('/novel/parse', { method: 'POST', body: JSON.stringify({ filePath }) }),
  generate: (filePath: string, chapterIndices?: number[], options?: { language?: string; style?: string; episodeTitle?: string }) =>
    request<NovelGenerateResult>('/novel/generate', { method: 'POST', body: JSON.stringify({ filePath, chapterIndices, ...options }) }),
}
