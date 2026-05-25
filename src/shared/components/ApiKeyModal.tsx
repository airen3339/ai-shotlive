/**
 * API Key 配置弹窗
 */
import { useEffect, useState } from 'react'
import { X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { getConfig, setApiKey } from '@/config'
import { storage } from '@/services/storage'
import { resetProvider } from '@/services/ai'

interface Props {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'ai.apiKey'

export async function loadApiKeyFromStorage() {
  const saved = await storage.loadConfig<string>(STORAGE_KEY)
  if (saved) setApiKey(saved)
}

export function ApiKeyModal({ open, onClose }: Props) {
  const [value, setValue] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(getConfig().ai.apiKey)
      setVisible(false)
    }
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const trimmed = value.trim()
      setApiKey(trimmed)
      await storage.saveConfig(STORAGE_KEY, trimmed)
      resetProvider()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8, 8, 10, 0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="surface-raised relative w-[480px] max-w-[92vw] reveal-rise"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-3 left-6 mono text-[0.65rem] tracking-[0.3em] uppercase bg-ink-950 px-2"
             style={{ color: 'var(--color-amber-leader)' }}>
          ATELIER · CREDENTIALS
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-paper-400 hover:text-paper-100"
          aria-label="关闭"
        >
          <X size={18} strokeWidth={1.4} />
        </button>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-1">
            <KeyRound size={18} strokeWidth={1.4} style={{ color: 'var(--color-amber-leader)' }} />
            <h2 className="display text-2xl">API 密钥</h2>
          </div>
          <p className="text-sm text-paper-400 mb-6 leading-relaxed">
            DashScope（阿里云百炼）的 API Key 仅保存于本机 IndexedDB，
            不会上传到任何服务器。
          </p>

          <label className="label block mb-2">SK · DASHSCOPE</label>
          <div className="relative">
            <input
              type={visible ? 'text' : 'password'}
              className="field w-full mono pr-12"
              placeholder="sk-..."
              value={value}
              onChange={e => setValue(e.target.value)}
              spellCheck={false}
              autoFocus
            />
            <button
              onClick={() => setVisible(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-paper-400 hover:text-amber-leader"
              type="button"
              aria-label={visible ? '隐藏' : '显示'}
              style={{ color: 'var(--color-paper-400)' }}
            >
              {visible ? <EyeOff size={16} strokeWidth={1.4} /> : <Eye size={16} strokeWidth={1.4} />}
            </button>
          </div>

          <div className="rule mt-8 pt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn-ghost">取消</button>
            <button onClick={handleSave} disabled={saving} className="btn-amber">
              {saving ? '保存中…' : '保存密钥'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
