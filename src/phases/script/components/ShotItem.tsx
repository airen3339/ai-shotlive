/**
 * ShotItem — 单个镜头条目（可编辑）
 */
import { useState } from 'react'
import { Trash2, Clock, Camera, Check, X } from 'lucide-react'
import type { Shot } from '@/types'

interface ShotItemProps {
  shot: Shot
  index: number
  onUpdate: (patch: Partial<Shot>) => void
  onDelete: () => void
}

const ANGLE_OPTIONS = [
  '全景', '中景', '近景', '特写', '大特写',
  '俯拍', '仰拍', '鸟瞰', '航拍', '过肩镜头',
  '主观视角', '空镜',
]

export function ShotItem({ shot, index, onUpdate, onDelete }: ShotItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(shot.description)
  const [angleDraft, setAngleDraft] = useState(shot.cameraAngle ?? '')
  const [durationDraft, setDurationDraft] = useState(shot.duration ?? 3)

  const startEdit = () => {
    setDraft(shot.description)
    setAngleDraft(shot.cameraAngle ?? '')
    setDurationDraft(shot.duration ?? 3)
    setEditing(true)
  }

  const commit = () => {
    onUpdate({
      description: draft.trim() || shot.description,
      cameraAngle: angleDraft.trim() || undefined,
      duration: Number.isFinite(durationDraft) && durationDraft > 0 ? durationDraft : undefined,
    })
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
  }

  return (
    <li className="px-5 py-4 group relative"
        style={{ borderTop: '1px solid var(--color-ink-700)' }}>
      <div className="flex items-start gap-4">
        {/* Shot number — film-slate inspired */}
        <div className="shrink-0 w-10 text-center">
          <div className="mono text-[0.6rem] tracking-[0.18em] uppercase"
               style={{ color: 'var(--color-paper-500)' }}>
            SHOT
          </div>
          <div className="display text-xl leading-none mt-0.5"
               style={{ color: 'var(--color-amber-deep)' }}>
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                placeholder="镜头描述：动作、表情、画面构图…"
                className="field w-full text-[0.88rem] leading-relaxed resize-none"
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Camera size={11} style={{ color: 'var(--color-paper-500)' }} />
                  <select
                    value={angleDraft}
                    onChange={e => setAngleDraft(e.target.value)}
                    className="field text-[0.78rem] py-1.5 px-2"
                  >
                    <option value="">未指定</option>
                    {ANGLE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={11} style={{ color: 'var(--color-paper-500)' }} />
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationDraft}
                    onChange={e => setDurationDraft(Number(e.target.value))}
                    className="field w-16 text-[0.78rem] py-1.5 px-2"
                  />
                  <span className="mono text-[0.65rem]" style={{ color: 'var(--color-paper-500)' }}>
                    秒
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={cancel}
                    className="p-1.5 hover:bg-ink-800/60 transition"
                    title="取消"
                  >
                    <X size={13} style={{ color: 'var(--color-paper-400)' }} />
                  </button>
                  <button
                    onClick={commit}
                    className="p-1.5 transition"
                    title="保存"
                    style={{ color: 'var(--color-amber-leader)' }}
                  >
                    <Check size={13} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="text-left w-full -mx-2 px-2 py-1 hover:bg-ink-800/40 transition rounded-sm"
              title="点击编辑"
            >
              <p className="text-[0.88rem] leading-relaxed"
                 style={{ color: 'var(--color-paper-100)' }}>
                {shot.description || (
                  <span className="italic" style={{ color: 'var(--color-paper-500)' }}>
                    （点击补充镜头描述）
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3 mt-2">
                {shot.cameraAngle && (
                  <span className="mono text-[0.62rem] tracking-[0.16em] uppercase px-1.5 py-0.5 border"
                        style={{
                          color: 'var(--color-amber-leader)',
                          borderColor: 'var(--color-amber-deep)',
                        }}>
                    {shot.cameraAngle}
                  </span>
                )}
                {shot.duration && (
                  <span className="mono text-[0.62rem] tracking-[0.14em] flex items-center gap-1"
                        style={{ color: 'var(--color-paper-400)' }}>
                    <Clock size={9} strokeWidth={2} />
                    {shot.duration}s
                  </span>
                )}
              </div>
            </button>
          )}
        </div>

        {!editing && (
          <button
            onClick={onDelete}
            className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 transition"
            title="删除镜头"
          >
            <Trash2 size={12} style={{ color: 'var(--color-crimson-mark)' }} />
          </button>
        )}
      </div>
    </li>
  )
}
