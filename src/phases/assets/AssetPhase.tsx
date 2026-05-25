/**
 * Phase 02 · 资产生成 AssetPhase
 *   控制论"反馈环路"：
 *     展示待生成资产 → 调用 AI 生成 → 预览结果 → 不满意可重生
 *
 *   - 角色定妆（CharacterAssetCard）
 *   - 场景概念（SceneAssetCard）
 *   - 一键显影（批量生成 + 进度 + 取消）
 *   - 全屏预览（ImagePreview）
 */
import { useMemo, useRef, useState } from 'react'
import {
  User,
  MapPin,
  Sparkles,
  Wand2,
  XCircle,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react'
import { useProject } from '@/shared/contexts/ProjectContext'
import { useImageAI } from '@/shared/hooks/useAI'
import { PhaseHeader } from '@/shared/components/PhaseHeader'
import type { Character, Project, Scene } from '@/types'
import { CharacterAssetCard } from './components/CharacterAssetCard'
import { SceneAssetCard } from './components/SceneAssetCard'
import { ImagePreview } from './components/ImagePreview'

// ===== Prompt builders =====
function buildCharacterPrompt(c: Character): string {
  const desc =
    (c.appearance && c.appearance.trim()) ||
    (c.description && c.description.trim()) ||
    c.name ||
    'a fictional character'
  return `Character design sheet, ${desc}, full body, front view, anime style, white background, high quality`
}

function buildScenePrompt(s: Scene): string {
  const desc =
    (s.description && s.description.trim()) || s.title || 'a cinematic scene'
  return `Scene concept art, ${desc}, cinematic lighting, wide shot, detailed environment, anime style`
}

// ===== Component =====
export function AssetPhase() {
  const { project, updateProject } = useProject()
  const { generate } = useImageAI()

  // Per-id transient state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Batch state
  const [batch, setBatch] = useState<{
    running: boolean
    current: number
    total: number
    label: string
  }>({ running: false, current: 0, total: 0, label: '' })
  const cancelRef = useRef(false)

  // Preview state
  const [preview, setPreview] = useState<{
    url: string
    label: string
    caption: string
  } | null>(null)

  if (!project) return null
  const { characters, scenes } = project.script
  const charImgs = project.assets.characterImages
  const sceneImgs = project.assets.sceneImages

  // ===== Counters =====
  const charDone = characters.filter(
    (c) => Boolean(c.referenceImage) || Boolean(charImgs[c.id]),
  ).length
  const sceneDone = scenes.filter((s) => Boolean(sceneImgs[s.id])).length
  const totalAssets = characters.length + scenes.length
  const totalDone = charDone + sceneDone
  const phaseComplete = charDone >= 1

  // Pending list for batch
  const pending = useMemo(
    () => buildPending(project),
    [project, charImgs, sceneImgs],
  )

  // ===== Generators =====
  async function generateForCharacter(c: Character) {
    setActiveId(c.id)
    setErrors((e) => ({ ...e, [c.id]: '' }))
    try {
      const prompt = buildCharacterPrompt(c)
      const result = await generate(prompt, { width: 720, height: 1280 })
      updateProject((p) => ({
        ...p,
        script: {
          ...p.script,
          characters: p.script.characters.map((ch) =>
            ch.id === c.id ? { ...ch, referenceImage: result.url } : ch,
          ),
        },
        assets: {
          ...p.assets,
          characterImages: { ...p.assets.characterImages, [c.id]: result.url },
        },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败'
      setErrors((e) => ({ ...e, [c.id]: msg }))
      throw err
    } finally {
      setActiveId(null)
    }
  }

  async function generateForScene(s: Scene) {
    setActiveId(s.id)
    setErrors((e) => ({ ...e, [s.id]: '' }))
    try {
      const prompt = buildScenePrompt(s)
      const result = await generate(prompt, { width: 1280, height: 720 })
      updateProject((p) => ({
        ...p,
        assets: {
          ...p.assets,
          sceneImages: { ...p.assets.sceneImages, [s.id]: result.url },
        },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败'
      setErrors((e) => ({ ...e, [s.id]: msg }))
      throw err
    } finally {
      setActiveId(null)
    }
  }

  // ===== Batch =====
  async function runBatch() {
    if (batch.running) return
    if (pending.length === 0) return
    cancelRef.current = false
    setBatch({
      running: true,
      current: 0,
      total: pending.length,
      label: '准备显影…',
    })
    for (let i = 0; i < pending.length; i++) {
      if (cancelRef.current) break
      const item = pending[i]
      const label =
        item.kind === 'character'
          ? `角色 · ${item.target.name || '(未命名)'}`
          : `场景 · ${item.target.title || '(未命名)'}`
      setBatch({ running: true, current: i + 1, total: pending.length, label })
      try {
        if (item.kind === 'character') await generateForCharacter(item.target)
        else await generateForScene(item.target)
      } catch {
        // continue on error; per-card error already recorded
      }
    }
    setBatch({ running: false, current: 0, total: 0, label: '' })
  }

  function cancelBatch() {
    cancelRef.current = true
    setBatch((b) => ({ ...b, label: '正在收尾…' }))
  }

  // ===== Render =====
  const isRunning = batch.running
  const cardDisabled = isRunning

  return (
    <div className="px-10 lg:px-16 py-12 max-w-[1400px] mx-auto">
      <PhaseHeader phase="assets" />

      <div className="rule mt-12 mb-8" />

      {/* Conductor strip — overall progress + batch CTA */}
      <ConductorStrip
        charDone={charDone}
        charTotal={characters.length}
        sceneDone={sceneDone}
        sceneTotal={scenes.length}
        totalDone={totalDone}
        totalAssets={totalAssets}
        phaseComplete={phaseComplete}
        pendingCount={pending.length}
        batch={batch}
        onRun={runBatch}
        onCancel={cancelBatch}
      />

      <div className="rule mt-10 mb-10" />

      {/* Characters */}
      <section className="reveal-rise mb-14">
        <SectionHead
          icon={User}
          title="角色定妆"
          subtitle="CHARACTER REFERENCE"
          desc="为每位角色生成参考图，作为后续镜头一致性的锚点。"
          done={charDone}
          total={characters.length}
        />

        {characters.length === 0 ? (
          <Empty hint="请先在 Phase 01 创建角色。" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-6">
            {characters.map((c, i) => (
              <CharacterAssetCard
                key={c.id}
                index={i}
                character={c}
                imageUrl={charImgs[c.id] ?? c.referenceImage}
                busy={activeId === c.id}
                disabled={cardDisabled && activeId !== c.id}
                error={errors[c.id]}
                onGenerate={() => generateForCharacter(c).catch(() => {})}
                onPreview={(url, label, caption) =>
                  setPreview({ url, label, caption })
                }
              />
            ))}
          </div>
        )}
      </section>

      <div className="rule mb-10" />

      {/* Scenes */}
      <section className="reveal-rise" style={{ animationDelay: '120ms' }}>
        <SectionHead
          icon={MapPin}
          title="场景概念"
          subtitle="SCENE REFERENCE"
          desc="为关键场景绘制参考画面，定义美术与光线方向。"
          done={sceneDone}
          total={scenes.length}
        />

        {scenes.length === 0 ? (
          <Empty hint="请先在 Phase 01 创建场景。" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {scenes.map((s, i) => (
              <SceneAssetCard
                key={s.id}
                index={i}
                scene={s}
                imageUrl={sceneImgs[s.id]}
                busy={activeId === s.id}
                disabled={cardDisabled && activeId !== s.id}
                error={errors[s.id]}
                onGenerate={() => generateForScene(s).catch(() => {})}
                onPreview={(url, label, caption) =>
                  setPreview({ url, label, caption })
                }
              />
            ))}
          </div>
        )}
      </section>

      {preview && (
        <ImagePreview
          url={preview.url}
          label={preview.label}
          caption={preview.caption}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// ===== Pending builder =====
type PendingItem =
  | { kind: 'character'; target: Character }
  | { kind: 'scene'; target: Scene }

function buildPending(p: Project): PendingItem[] {
  const list: PendingItem[] = []
  for (const c of p.script.characters) {
    if (!c.referenceImage && !p.assets.characterImages[c.id]) {
      list.push({ kind: 'character', target: c })
    }
  }
  for (const s of p.script.scenes) {
    if (!p.assets.sceneImages[s.id]) {
      list.push({ kind: 'scene', target: s })
    }
  }
  return list
}

// ===== Conductor strip =====
function ConductorStrip({
  charDone,
  charTotal,
  sceneDone,
  sceneTotal,
  totalDone,
  totalAssets,
  phaseComplete,
  pendingCount,
  batch,
  onRun,
  onCancel,
}: {
  charDone: number
  charTotal: number
  sceneDone: number
  sceneTotal: number
  totalDone: number
  totalAssets: number
  phaseComplete: boolean
  pendingCount: number
  batch: { running: boolean; current: number; total: number; label: string }
  onRun: () => void
  onCancel: () => void
}) {
  const overallPct =
    totalAssets === 0 ? 0 : Math.round((totalDone / totalAssets) * 100)
  const batchPct =
    batch.total === 0 ? 0 : Math.round((batch.current / batch.total) * 100)

  return (
    <div className="surface-raised reveal-rise grid grid-cols-12 gap-6 px-7 py-6">
      {/* Left: stats */}
      <div className="col-span-12 lg:col-span-7 grid grid-cols-3 gap-6">
        <Stat
          icon={User}
          label="角色定妆"
          english="ROLE PLATES"
          value={charDone}
          total={charTotal}
          accent={phaseComplete}
        />
        <Stat
          icon={MapPin}
          label="场景概念"
          english="SCENE PLATES"
          value={sceneDone}
          total={sceneTotal}
        />
        <Stat
          icon={ImageIcon}
          label="资产汇总"
          english="ASSETS TOTAL"
          value={totalDone}
          total={totalAssets}
          pct={overallPct}
        />
      </div>

      {/* Right: batch CTA / progress */}
      <div className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-4 lg:border-l lg:pl-6"
           style={{ borderColor: 'var(--color-ink-600)' }}>
        {batch.running ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span
                className="mono text-[0.65rem] tracking-[0.22em] uppercase flex items-center gap-2"
                style={{ color: 'var(--color-amber-leader)' }}
              >
                <span className="tick tick-rec" /> EXPOSING · 显影中
              </span>
              <span
                className="mono text-[0.7rem] tracking-[0.16em]"
                style={{ color: 'var(--color-paper-200)' }}
              >
                {String(batch.current).padStart(2, '0')} /{' '}
                {String(batch.total).padStart(2, '0')}
              </span>
            </div>
            <div
              className="mt-3 h-px relative overflow-hidden"
              style={{ background: 'var(--color-ink-700)' }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${batchPct}%`,
                  background:
                    'linear-gradient(90deg, var(--color-amber-deep), var(--color-amber-leader))',
                }}
              />
            </div>
            <div
              className="mt-3 text-[0.78rem] truncate"
              style={{ color: 'var(--color-paper-300)' }}
            >
              {batch.label}
            </div>
            <button
              onClick={onCancel}
              className="btn-ghost mt-4 flex items-center gap-2"
            >
              <XCircle size={12} strokeWidth={1.6} />
              中止显影
            </button>
          </div>
        ) : (
          <>
            <div>
              <div
                className="mono text-[0.65rem] tracking-[0.22em] uppercase flex items-center gap-2"
                style={{
                  color: phaseComplete
                    ? 'var(--color-amber-leader)'
                    : 'var(--color-paper-500)',
                }}
              >
                {phaseComplete ? (
                  <>
                    <CheckCircle2 size={11} strokeWidth={1.6} />
                    READY · 章节就绪
                  </>
                ) : (
                  <>
                    <Sparkles size={11} strokeWidth={1.6} />
                    AWAITING · 等待显影
                  </>
                )}
              </div>
              <div
                className="display text-[1.65rem] mt-1 leading-tight"
                style={{ color: 'var(--color-paper-50)' }}
              >
                {pendingCount === 0
                  ? '一切已显影。'
                  : `${pendingCount} 项待生成`}
              </div>
              <p
                className="text-[0.78rem] mt-1.5 leading-relaxed"
                style={{ color: 'var(--color-paper-400)' }}
              >
                进入暗房，依次生成全部缺失的角色与场景画面。可中途打断。
              </p>
            </div>
            <button
              onClick={onRun}
              disabled={pendingCount === 0}
              className="btn-amber flex items-center gap-2 self-start"
            >
              <Wand2 size={13} strokeWidth={1.6} />
              一键显影 · BATCH EXPOSE
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  english,
  value,
  total,
  pct,
  accent,
}: {
  icon: typeof User
  label: string
  english: string
  value: number
  total: number
  pct?: number
  accent?: boolean
}) {
  const computedPct =
    pct ?? (total === 0 ? 0 : Math.round((value / total) * 100))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon
          size={13}
          strokeWidth={1.4}
          style={{
            color: accent
              ? 'var(--color-amber-leader)'
              : 'var(--color-paper-400)',
          }}
        />
        <span
          className="mono text-[0.6rem] tracking-[0.2em] uppercase"
          style={{ color: 'var(--color-paper-500)' }}
        >
          {english}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="display text-3xl leading-none"
          style={{
            color: accent
              ? 'var(--color-amber-leader)'
              : 'var(--color-paper-50)',
          }}
        >
          {value}
        </span>
        <span
          className="mono text-[0.78rem]"
          style={{ color: 'var(--color-paper-500)' }}
        >
          / {total.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="text-[0.78rem]" style={{ color: 'var(--color-paper-300)' }}>
        {label}
      </div>
      <div
        className="h-px relative overflow-hidden"
        style={{ background: 'var(--color-ink-700)' }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700"
          style={{
            width: `${computedPct}%`,
            background: accent
              ? 'linear-gradient(90deg, var(--color-amber-deep), var(--color-amber-leader))'
              : 'var(--color-paper-500)',
          }}
        />
      </div>
    </div>
  )
}

function SectionHead({
  icon: Icon,
  title,
  subtitle,
  desc,
  done,
  total,
}: {
  icon: typeof User
  title: string
  subtitle: string
  desc: string
  done: number
  total: number
}) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="flex items-end gap-4">
        <Icon
          size={18}
          strokeWidth={1.4}
          style={{ color: 'var(--color-amber-leader)' }}
          className="mb-1.5"
        />
        <div>
          <div
            className="display text-2xl tracking-tight"
            style={{ color: 'var(--color-paper-50)' }}
          >
            {title}
          </div>
          <div
            className="mono text-[0.65rem] tracking-[0.2em] uppercase mt-1"
            style={{ color: 'var(--color-paper-500)' }}
          >
            {subtitle} ·{' '}
            <span style={{ color: 'var(--color-amber-deep)' }}>
              {done.toString().padStart(2, '0')}
            </span>{' '}
            / {total.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
      <div
        className="text-[0.85rem] max-w-md text-right"
        style={{ color: 'var(--color-paper-400)' }}
      >
        {desc}
      </div>
    </div>
  )
}

function Empty({ hint }: { hint: string }) {
  return (
    <div
      className="surface mt-6 px-6 py-12 text-center mono text-[0.7rem] tracking-[0.18em] uppercase italic"
      style={{ color: 'var(--color-paper-500)' }}
    >
      {hint}
    </div>
  )
}


