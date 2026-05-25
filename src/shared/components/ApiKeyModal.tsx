/**
 * API Key 配置弹窗
 * 支持分别配置文本/图像/视频三种 API Key
 */
import { useEffect, useState } from 'react'
import { X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { getConfig, setModelConfig, hasAnyApiKey } from '@/config'
import { storage } from '@/services/storage'
import { resetProviders } from '@/services/ai'

const STORAGE_KEYS = {
  text: 'ai.text.apiKey',
  image: 'ai.image.apiKey',
  video: 'ai.video.apiKey',
}

export async function loadApiKeyFromStorage() {
  for (const [section, key] of Object.entries(STORAGE_KEYS)) {
    const saved = await storage.loadConfig<string>(key)
    if (saved) {
      setModelConfig(section as 'text' | 'image' | 'video', { apiKey: saved })
    }
  }
}

interface Props {
  open: boolean
  onClose: () => void
}

type Section = 'text' | 'image' | 'video'

const SECTION_LABELS: Record<Section, { title: string; desc: string }> = {
  text: { title: '文本模型', desc: '百炼 Qwen（剧本分析）' },
  image: { title: '图像模型', desc: '百炼万相 / 火山引擎 Seedream（首帧生成）' },
  video: { title: '视频模型', desc: '火山引擎 Seedance（视频生成）' },
}

export function ApiKeyModal({ open, onClose }: Props) {
  const [section, setSection] = useState<Section>('text')
  const [values, setValues] = useState({ text: '', image: '', video: '' })
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const cfg = getConfig()
      setValues({
        text: cfg.text.apiKey,
        image: cfg.image.apiKey,
        video: cfg.video.apiKey,
      })
      setVisible(false)
      setSection('text')
    }
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const s of ['text', 'image', 'video'] as Section[]) {
        const trimmed = values[s].trim()
        setModelConfig(s, { apiKey: trimmed })
        await storage.saveConfig(STORAGE_KEYS[s], trimmed)
      }
      resetProviders()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const current = SECTION_LABELS[section]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8, 8, 10, 0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="surface-raised relative w-[560px] max-w-[92vw] reveal-rise"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-3 left-6 mono text-[0.65rem] tracking-[0.3em] uppercase bg-ink-950 px-2"
             style={{ color: 'var(--color-amber-leader)' }}>
          API CONFIGURATION · 模型配置
        </div>

        <button onClick={onClose} className="absolute top-5 right-5 text-paper-400 hover:text-paper-100" aria-label="关闭">
          <X size={18} />
        </button>

        <div className="pt-8 px-8 pb-6">
          {/* Section tabs */}
          <div className="flex gap-2 mb-6">
            {(['text', 'image', 'video'] as Section[]).map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className="px-3 py-1.5 mono text-[0.65rem] tracking-[0.15em] uppercase rounded transition-all"
                style={{
                  background: section === s ? 'var(--color-amber-leader)' : 'var(--color-ink-700)',
                  color: section === s ? 'var(--color-ink-950)' : 'var(--color-paper-400)',
                }}
              >
                {SECTION_LABELS[s].title}
              </button>
            ))}
          </div>

          <div className="mb-2 mono text-[0.7rem]" style={{ color: 'var(--color-paper-500)' }}>
            {current.desc}
          </div>

          <div className="relative">
            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-paper-500)' }} />
            <input
              type={visible ? 'text' : 'password'}
              value={values[section]}
              onChange={e => setValues(v => ({ ...v, [section]: e.target.value }))}
              placeholder={`请输入 ${current.title} API Key`}
              className="w-full pl-10 pr-10 py-3 bg-ink-800 border text-paper-100 placeholder:text-paper-500 focus:outline-none"
              style={{ borderColor: 'var(--color-ink-600)' }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisible(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-paper-400"
              aria-label={visible ? '隐藏' : '显示'}
            >
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {values[section].trim() && (
            <div className="mt-2 flex items-center gap-2" style={{ color: 'var(--color-amber-leader)' }}>
              <span className="text-xs">✓</span>
              <span className="mono text-[0.65rem]">已输入 {values[section].length} 个字符</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-8 pb-6">
          <button
            onClick={onClose}
            className="px-5 py-2 mono text-[0.7rem] tracking-[0.12em] uppercase"
            style={{ color: 'var(--color-paper-400)' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 mono text-[0.7rem] tracking-[0.12em] uppercase text-ink-950 disabled:opacity-50"
            style={{ background: 'var(--color-amber-leader)' }}
          >
            {saving ? '保存中...' : '保存全部'}
          </button>
        </div>
      </div>
    </div>
  )
}
