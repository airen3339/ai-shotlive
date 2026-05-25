/**
 * CharacterCard — 角色卡片（可编辑；预留参考图位）
 */
import { useState } from 'react'
import { Trash2, Edit3, Check, X, User, ImageOff } from 'lucide-react'
import type { Character } from '@/types'

interface CharacterCardProps {
  character: Character
  index: number
  onUpdate: (patch: Partial<Character>) => void
  onDelete: () => void
}

export function CharacterCard({
  character, index, onUpdate, onDelete,
}: CharacterCardProps) {
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(character.name)
  const [descDraft, setDescDraft] = useState(character.description)
  const [appDraft, setAppDraft] = useState(character.appearance)

  const startEdit = () => {
    setNameDraft(character.name)
    setDescDraft(character.description)
    setAppDraft(character.appearance)
    setEditing(true)
  }

  const commit = () => {
    onUpdate({
      name: nameDraft.trim() || character.name || '未命名角色',
      description: descDraft.trim(),
      appearance: appDraft.trim(),
    })
    setEditing(false)
  }

  return (
    <article className="surface-raised reveal-rise overflow-hidden"
             style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex">
        {/* Reference image slot — film strip frame */}
        <div className="relative shrink-0 w-32 border-r"
             style={{
               borderColor: 'var(--color-ink-700)',
               background: 'var(--color-ink-900)',
             }}>
          {character.referenceImage ? (
            <img
              src={character.referenceImage}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 relative">
              <ImageOff size={20} strokeWidth={1.2}
                        style={{ color: 'var(--color-paper-500)' }} />
              <span className="mono text-[0.55rem] tracking-[0.2em] uppercase text-center px-2 leading-tight"
                    style={{ color: 'var(--color-paper-500)' }}>
                定妆图<br />Phase 02
              </span>
              {/* Decorative perforations */}
              <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-around"
                   aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ background: 'var(--color-ink-600)' }} />
                ))}
              </div>
              <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-around"
                   aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ background: 'var(--color-ink-600)' }} />
                ))}
              </div>
            </div>
          )}

          {/* Cast number badge */}
          <div className="absolute top-0 left-0 px-2 py-1 mono text-[0.6rem] tracking-[0.18em] uppercase"
               style={{
                 background: 'var(--color-ink-950)',
                 color: 'var(--color-amber-leader)',
               }}>
            #{String(index + 1).padStart(2, '0')}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 p-5">
          {editing ? (
            <div className="space-y-2">
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                placeholder="角色名"
                className="field w-full display text-lg"
                autoFocus
              />
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                rows={2}
                placeholder="性格 · 背景"
                className="field w-full text-[0.82rem] resize-none leading-relaxed"
              />
              <textarea
                value={appDraft}
                onChange={e => setAppDraft(e.target.value)}
                rows={2}
                placeholder="外貌：发型、服装、体型…（用于生成图像）"
                className="field w-full text-[0.82rem] resize-none leading-relaxed"
              />
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="btn-ghost flex items-center gap-1.5 py-1.5 px-3 text-[0.7rem]"
                >
                  <X size={11} />
                  取消
                </button>
                <button
                  onClick={commit}
                  className="btn-amber flex items-center gap-1.5 py-1.5 px-3 text-[0.7rem]"
                >
                  <Check size={11} />
                  保存
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 mb-2">
                <button
                  onClick={startEdit}
                  className="text-left group/name flex items-center gap-2"
                  title="点击编辑"
                >
                  <User size={12} strokeWidth={1.5}
                        style={{ color: 'var(--color-amber-deep)' }} />
                  <h3 className="display text-lg tracking-tight"
                      style={{ color: 'var(--color-paper-50)' }}>
                    {character.name || '未命名角色'}
                  </h3>
                  <Edit3 size={10}
                         className="opacity-0 group-hover/name:opacity-100 transition"
                         style={{ color: 'var(--color-amber-leader)' }} />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    className="p-1.5 transition"
                    title="删除角色"
                  >
                    <Trash2 size={11} style={{ color: 'var(--color-crimson-mark)' }} />
                  </button>
                </div>
              </div>

              <button
                onClick={startEdit}
                className="text-left w-full -mx-1 px-1 py-0.5 rounded-sm hover:bg-ink-800/40 transition"
              >
                {character.description ? (
                  <p className="text-[0.8rem] leading-relaxed"
                     style={{ color: 'var(--color-paper-200)' }}>
                    {character.description}
                  </p>
                ) : (
                  <p className="text-[0.75rem] italic"
                     style={{ color: 'var(--color-paper-500)' }}>
                    （点击补充性格与背景）
                  </p>
                )}
              </button>

              {character.appearance && (
                <div className="mt-3 pt-3"
                     style={{ borderTop: '1px dashed var(--color-ink-600)' }}>
                  <div className="label text-[0.6rem] mb-1.5 flex items-center gap-1.5">
                    <span className="tick tick-active" style={{ width: 4, height: 4 }} />
                    外貌 · APPEARANCE
                  </div>
                  <p className="text-[0.78rem] leading-relaxed italic"
                     style={{ color: 'var(--color-paper-400)' }}>
                    {character.appearance}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}
