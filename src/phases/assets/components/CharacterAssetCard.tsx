/**
 * CharacterAssetCard — 角色定妆胶片卡
 *   Aesthetic: 暗房显影 — film plate aspect, sweep light during exposure
 */
import { Wand2, RefreshCw, ZoomIn, AlertTriangle, ImageIcon, CheckCircle2 } from 'lucide-react'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { Character } from '@/types'

interface Props {
  character: Character
  index: number
  imageUrl?: string
  busy: boolean
  disabled: boolean
  error?: string
  onGenerate: () => void
  onPreview: (url: string, label: string, caption: string) => void
}

export function CharacterAssetCard({
  character,
  index,
  imageUrl,
  busy,
  disabled,
  error,
  onGenerate,
  onPreview,
}: Props) {
  const has = Boolean(imageUrl)
  const num = String(index + 1).padStart(2, '0')

  return (
    <div
      className="surface group flex flex-col relative transition-all duration-300"
      style={{
        boxShadow: has ? '0 18px 36px -22px rgba(212, 165, 116, 0.18)' : 'none',
      }}
    >
      {/* Plate / Frame */}
      <div
        className="aspect-[3/4] relative overflow-hidden"
        style={{ background: 'var(--color-ink-900)' }}
      >
        {has && imageUrl ? (
          <button
            type="button"
            onClick={() =>
              onPreview(
                imageUrl,
                character.name || `Character ${num}`,
                character.appearance || character.description || '—',
              )
            }
            className="absolute inset-0 cursor-zoom-in"
            aria-label="放大查看"
          >
            <img
              src={imageUrl}
              alt={character.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            {/* Hover veil + zoom hint */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,8,10,0) 40%, rgba(8,8,10,0.7) 100%)',
              }}
            />
            <span
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 mono text-[0.6rem] tracking-[0.18em] uppercase opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'var(--color-ink-950)',
                color: 'var(--color-amber-glow)',
                border: '1px solid var(--color-amber-deep)',
              }}
            >
              <ZoomIn size={11} strokeWidth={1.5} /> ENLARGE
            </span>
          </button>
        ) : busy ? (
          <DevelopingPlate />
        ) : (
          <UndevelopedPlate />
        )}

        {/* Top-left badge */}
        <span
          className="absolute top-2 left-2 mono text-[0.6rem] tracking-[0.18em] uppercase px-2 py-0.5 pointer-events-none"
          style={{
            background: 'var(--color-ink-950)',
            color: 'var(--color-amber-leader)',
            border: '1px solid var(--color-ink-700)',
          }}
        >
          ROLE · {num}
        </span>

        {/* Status badge */}
        {has && !busy && (
          <span
            className="absolute top-2 right-2 flex items-center gap-1 mono text-[0.58rem] tracking-[0.16em] uppercase px-2 py-0.5 pointer-events-none"
            style={{
              background: 'var(--color-ink-950)',
              color: 'var(--color-amber-glow)',
              border: '1px solid var(--color-amber-deep)',
            }}
          >
            <CheckCircle2 size={10} strokeWidth={1.6} /> 已显影
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <div
            className="font-medium text-[0.95rem] truncate"
            style={{ color: 'var(--color-paper-100)' }}
          >
            {character.name || '(未命名)'}
          </div>
          <span
            className="mono text-[0.58rem] tracking-[0.18em] uppercase shrink-0"
            style={{ color: 'var(--color-paper-500)' }}
          >
            CAST·{num}
          </span>
        </div>

        <div
          className="text-[0.78rem] mt-1 line-clamp-2 flex-1"
          style={{ color: 'var(--color-paper-400)' }}
        >
          {character.appearance || character.description || '尚无形象描述'}
        </div>

        {error && (
          <div
            className="mt-3 flex items-start gap-2 px-2.5 py-2"
            style={{
              border: '1px solid var(--color-crimson-deep)',
              background: 'rgba(200, 57, 44, 0.07)',
            }}
          >
            <AlertTriangle
              size={11}
              strokeWidth={1.6}
              className="mt-0.5 shrink-0"
              style={{ color: 'var(--color-crimson-mark)' }}
            />
            <span
              className="text-[0.7rem] leading-snug break-words"
              style={{ color: 'var(--color-paper-200)' }}
            >
              {error}
            </span>
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={busy || disabled}
          className="btn-ghost mt-4 w-full flex items-center justify-center gap-2"
        >
          {busy ? (
            <LoadingSpinner size="sm" label="显影中" />
          ) : (
            <>
              {has ? (
                <RefreshCw size={12} strokeWidth={1.6} />
              ) : (
                <Wand2 size={12} strokeWidth={1.6} />
              )}
              {has ? '重新生成' : '生成定妆图'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function UndevelopedPlate() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{
        background:
          'repeating-linear-gradient(45deg, var(--color-ink-900) 0 14px, var(--color-ink-850) 14px 28px)',
      }}
    >
      <div
        className="absolute inset-3 pointer-events-none"
        style={{ border: '1px dashed var(--color-ink-600)' }}
      />
      <ImageIcon size={26} strokeWidth={1} style={{ color: 'var(--color-paper-500)' }} />
      <span
        className="mono text-[0.6rem] tracking-[0.22em] uppercase"
        style={{ color: 'var(--color-paper-500)' }}
      >
        UNDEVELOPED
      </span>
    </div>
  )
}

function DevelopingPlate() {
  return (
    <div
      className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-ink-900)' }}
    >
      {/* sweeping light */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, transparent 0%, transparent 35%, rgba(212, 165, 116, 0.22) 50%, transparent 65%, transparent 100%)',
          backgroundSize: '220% 100%',
          animation: 'asset-sweep 1.6s linear infinite',
        }}
      />
      {/* horizontal scan */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-amber-leader), transparent)',
          animation: 'asset-scan 2.2s ease-in-out infinite',
        }}
      />
      <LoadingSpinner size="md" />
      <span
        className="mono text-[0.62rem] tracking-[0.28em] uppercase relative z-10"
        style={{ color: 'var(--color-amber-leader)' }}
      >
        EXPOSING…
      </span>
      <style>{`
        @keyframes asset-sweep { from { background-position: 220% 0; } to { background-position: -220% 0; } }
        @keyframes asset-scan {
          0%, 100% { top: 12%; opacity: 0.2; }
          50% { top: 88%; opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
