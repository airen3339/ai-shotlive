/**
 * ImagePreview — 全屏图片预览模态
 *   暗房放映室视觉：黑色幕布 + 琥珀边线 + 静默打字标识
 */
import { useEffect } from 'react'
import { X, Maximize2 } from 'lucide-react'

interface Props {
  url: string
  label: string
  caption?: string
  onClose: () => void
}

export function ImagePreview({ url, label, caption, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-10 reveal-fade"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(20, 18, 16, 0.96), rgba(8, 8, 10, 0.98))',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Top-left marquee */}
      <div className="absolute top-6 left-8 flex items-center gap-3">
        <span
          className="tick tick-rec"
          style={{ background: 'var(--color-amber-leader)' }}
        />
        <span
          className="mono text-[0.7rem] tracking-[0.24em] uppercase"
          style={{ color: 'var(--color-amber-leader)' }}
        >
          DARKROOM · LOOPED
        </span>
        <span
          className="mono text-[0.7rem] tracking-[0.18em] uppercase"
          style={{ color: 'var(--color-paper-200)' }}
        >
          {label}
        </span>
      </div>

      {/* Top-right close */}
      <div className="absolute top-6 right-8 flex items-center gap-4">
        <span
          className="mono text-[0.62rem] tracking-[0.22em] uppercase"
          style={{ color: 'var(--color-paper-500)' }}
        >
          ESC · CLOSE
        </span>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="p-2 border transition-colors"
          style={{
            borderColor: 'var(--color-ink-500)',
            color: 'var(--color-paper-100)',
            background: 'var(--color-ink-900)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-amber-leader)'
            e.currentTarget.style.color = 'var(--color-amber-glow)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-ink-500)'
            e.currentTarget.style.color = 'var(--color-paper-100)'
          }}
        >
          <X size={16} strokeWidth={1.4} />
        </button>
      </div>

      {/* Image stage */}
      <div
        className="relative reveal-rise"
        style={{ maxWidth: 'min(90vw, 1400px)', maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer film frame */}
        <div
          className="absolute -inset-3 pointer-events-none"
          style={{
            border: '1px solid var(--color-amber-deep)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Corner sprocket marks */}
        {([
          ['-top-3', '-left-3'],
          ['-top-3', '-right-3'],
          ['-bottom-3', '-left-3'],
          ['-bottom-3', '-right-3'],
        ] as const).map(([y, x], i) => (
          <span
            key={i}
            className={`absolute ${y} ${x} pointer-events-none`}
            style={{
              width: 14,
              height: 14,
              border: '1px solid var(--color-amber-leader)',
              background: 'var(--color-ink-950)',
            }}
          />
        ))}

        <img
          src={url}
          alt={label}
          className="block object-contain"
          style={{
            maxWidth: 'min(90vw, 1400px)',
            maxHeight: '82vh',
            boxShadow: '0 30px 80px -30px rgba(0, 0, 0, 0.9)',
          }}
        />

        {/* Bottom caption strip */}
        <div
          className="absolute left-0 right-0 -bottom-12 flex items-center justify-between gap-6 px-1"
          style={{ color: 'var(--color-paper-400)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Maximize2
              size={11}
              strokeWidth={1.4}
              style={{ color: 'var(--color-amber-deep)' }}
            />
            <span className="mono text-[0.65rem] tracking-[0.18em] uppercase truncate">
              {caption ?? '原片定妆 · ORIGINAL PLATE'}
            </span>
          </div>
          <span
            className="mono text-[0.6rem] tracking-[0.16em] uppercase"
            style={{ color: 'var(--color-paper-500)' }}
          >
            CLICK · BACKDROP · TO · DISMISS
          </span>
        </div>
      </div>
    </div>
  )
}
