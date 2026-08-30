/**
 * 登录/注册界面
 */
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'var(--color-ink-900)', color: 'var(--color-paper-100)' }}>
      <div className="w-full max-w-sm p-8" style={{ background: 'var(--color-ink-800)' }}>
        <h1 className="text-2xl text-center mb-2" style={{ color: 'var(--color-amber-leader)' }}>
          AI-ShotLive Director
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--color-paper-400)' }}>
          {mode === 'login' ? '登录你的创作空间' : '创建你的账号'}
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 text-sm text-red-400"
               style={{ background: 'rgba(200, 57, 44, 0.1)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
              placeholder="输入用户名"
              required
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-paper-400)' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ background: 'rgba(128,128,128,0.1)', border: '1px solid var(--color-ink-600)' }}
              placeholder="至少 6 个字符"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full py-2 text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--color-amber-leader)',
              color: 'var(--color-ink-900)',
            }}
          >
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            className="text-sm hover:underline"
            style={{ color: 'var(--color-amber-leader)' }}
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null) }}
          >
            {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
