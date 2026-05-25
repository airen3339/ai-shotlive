/**
 * SceneCard — 场景卡片（可编辑、展开镜头）
 */
import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Plus, Trash2, MapPin, Film,
  Check, X, Edit3,
} from 'lucide-react'
import type { Scene, Shot } from '@/types'
import { ShotItem } from './ShotItem'

interface SceneCardProps {
  scene: Scene
  index: number
  onUpdate: (patch: Partial<Scene>) => void
  onDelete: () => void
  onAddShot: () => void
  onUpdateShot: (shotId: string, patch: Partial<Shot>) => void
  onDeleteShot: (shotId: string) => void
}

export function SceneCard({
  scene,
  index,
  onUpdate,
  onDelete,
  onAddShot,
  onUpdateShot,
  onDeleteShot,
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(scene.title)
  const [descDraft, setDescDraft] = useState(scene.description)

  const startEdit = () => {
    setTitleDraft(scene.title)
    setDescDraft(scene.description)
    setEditing(true)
  }

  const commit = () => {
    onUpdate({
      title: titleDraft.trim() || scene.title || '未命名场景',
      description: descDraft.trim(),
    })
    setEditing(false)
  }

  const totalDuration = scene.shots.reduce((acc, s) => acc + (s.duration ?? 0), 0)

  return (
    <article className="surface-raised reveal-rise relative"
             style={{ animationDelay: `${index * 60}ms` }}>
      {/* Top accent stripe */}
      <div className="absolute top-0 left-0 h-px w-16"
           style={{ background: 'var(--color-amber-leader)' }} />

      {/* Header */}
      <header className="px-7 pt-6 pb-5 flex items-start gap-5">
        {/* Big numeral — scene slate */}
        <div className="shrink-0">
          <div className="mono text-[0.6rem] tracking-[0.2em] uppercase"
               style={{ color: 'var(--color-paper-500)' }}>
            SCENE
          </div>
          <div className="phase-numeral text-5xl leading-none mt-1"
               style={{ color: 'var(--color-amber-leader)' }}>
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="场景标题"
                className="field w-full display text-xl"
                autoFocus
              />
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                rows={2}
                placeholder="场景描述（环境、氛围、时间…）"
                className="field w-full text-[0.85rem] leading-relaxed resize-none"
              />
              <div className="flex items-center gap-2 justify-end">
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
            <button
              onClick={startEdit}
              className="text-left w-full group/hdr"
              title="点击编辑"
            >
              <div className="flex items-center gap-2">
                <h3 className="display text-xl tracking-tight"
                    style={{ color: 'var(--color-paper-50)' }}>
                  {scene.title || '未命名场景'}
                </h3>
                <Edit3
                  size={11}
                  className="opacity-0 group-hover/hdr:opacity-100 transition"
                  style={{ color: 'var(--color-amber-leader)' }}
                />
              </div>
              {scene.description ? (
                <p className="text-[0.86rem] leading-relaxed mt-2"
                   style={{ color: 'var(--color-paper-400)' }}>
                  {scene.description}
                </p>
              ) : (
                <p className="text-[0.78rem] italic mt-2"
                   style={{ color: 'var(--color-paper-500)' }}>
                  （点击补充场景环境与氛围）
                </p>
              )}
            </button>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-5 mt-4">
            <span className="mono text-[0.65rem] tracking-[0.16em] uppercase flex items-center gap-1.5"
                  style={{ color: 'var(--color-paper-400)' }}>
              <Film size={10} strokeWidth={1.8} />
              {scene.shots.length} 镜
            </span>
            {totalDuration > 0 && (
              <span className="mono text-[0.65rem] tracking-[0.16em] uppercase"
                    style={{ color: 'var(--color-paper-400)' }}>
                ≈ {totalDuration}s
              </span>
            )}
            <span className="mono text-[0.65rem] tracking-[0.16em] uppercase ml-auto flex items-center gap-1.5"
                  style={{ color: 'var(--color-paper-500)' }}>
              <MapPin size={10} strokeWidth={1.8} />
              {scene.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDelete}
            className="p-2 transition"
            title="删除场景"
          >
            <Trash2 size={13} style={{ color: 'var(--color-crimson-mark)' }} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-2 transition"
            title={expanded ? '收起' : '展开'}
            style={{ color: 'var(--color-paper-400)' }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </header>

      {/* Shots */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-ink-700)' }}>
          {scene.shots.length === 0 ? (
            <div className="px-7 py-8 text-center mono text-[0.7rem] tracking-[0.16em] uppercase italic"
                 style={{ color: 'var(--color-paper-500)' }}>
              · 尚无镜头 ·
            </div>
          ) : (
            <ul>
              {scene.shots.map((shot, i) => (
                <ShotItem
                  key={shot.id}
                  shot={shot}
                  index={i}
                  onUpdate={patch => onUpdateShot(shot.id, patch)}
                  onDelete={() => onDeleteShot(shot.id)}
                />
              ))}
            </ul>
          )}

          <div className="px-5 py-3"
               style={{ borderTop: '1px solid var(--color-ink-700)' }}>
            <button
              onClick={onAddShot}
              className="w-full flex items-center justify-center gap-2 py-2 mono text-[0.7rem] tracking-[0.16em] uppercase transition hover:bg-ink-800/40"
              style={{ color: 'var(--color-paper-400)' }}
            >
              <Plus size={12} strokeWidth={2} />
              添加镜头
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
