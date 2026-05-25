/**
 * StoryInput — 故事大纲输入区
 * 控制论"信息-反馈律"起点：用户文本 → AI 拆解
 */
import { Wand2, FileText, RefreshCw } from 'lucide-react'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

interface StoryInputProps {
  value: string
  onChange: (next: string) => void
  onGenerate: () => void
  loading: boolean
  error: string | null
  hasGenerated: boolean
}

export function StoryInput({
  value,
  onChange,
  onGenerate,
  loading,
  error,
  hasGenerated,
}: StoryInputProps) {
  const charCount = value.length
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const canGenerate = !loading && value.trim().length >= 8

  return (
    <div className="reveal-rise">
      <div className="flex items-baseline justify-between mb-3">
        <div className="label flex items-center gap-2">
          <FileText size={11} strokeWidth={1.8} />
          故事大纲 · STORY OUTLINE
        </div>
        <div className="mono text-[0.62rem] tracking-[0.18em] uppercase"
             style={{ color: 'var(--color-paper-500)' }}>
          {wordCount} 词 · {charCount} 字
        </div>
      </div>

      <div className="surface relative">
        {/* Decorative film-perforation marks */}
        <div className="absolute top-0 left-0 right-0 flex justify-between px-3 py-1.5 pointer-events-none"
             aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="block w-1 h-1 rounded-full"
              style={{ background: 'var(--color-ink-600)' }}
            />
          ))}
        </div>

        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="输入你的故事大纲或剧本内容...（支持中文或英文）&#10;&#10;比如：「深夜的便利店，一个落魄编剧偶遇神秘女孩——」&#10;无需完美的句子。AI 将依据它拆分场景、定义角色、撰写镜头。"
          className="field w-full min-h-[300px] resize-none border-0 leading-relaxed pt-6"
          style={{ background: 'transparent' }}
          disabled={loading}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-3 px-4 py-3 border flex items-start gap-3"
             style={{
               background: 'rgba(200, 57, 44, 0.08)',
               borderColor: 'var(--color-crimson-deep)',
             }}>
          <span className="tick tick-rec mt-1.5 shrink-0" />
          <div className="flex-1">
            <div className="mono text-[0.65rem] tracking-[0.2em] uppercase mb-1"
                 style={{ color: 'var(--color-crimson-mark)' }}>
              拆解失败
            </div>
            <div className="text-[0.82rem]" style={{ color: 'var(--color-paper-200)' }}>
              {error}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mt-5 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="btn-amber flex items-center gap-2"
        >
          {loading ? (
            <LoadingSpinner size="sm" label="正在分析故事结构…" />
          ) : (
            <>
              {hasGenerated ? (
                <RefreshCw size={13} strokeWidth={1.8} />
              ) : (
                <Wand2 size={13} strokeWidth={1.8} />
              )}
              {hasGenerated ? '重新拆解' : 'AI 智能分镜'}
            </>
          )}
        </button>

        <div className="mono text-[0.65rem] tracking-[0.18em] uppercase"
             style={{ color: 'var(--color-paper-500)' }}>
          {hasGenerated
            ? '· 重写将覆盖现有场景与角色'
            : '一键拆分场景 · 角色 · 镜头'}
        </div>
      </div>
    </div>
  )
}
