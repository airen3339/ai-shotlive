/**
 * Phase 03 · 导演工作台 DirectorPhase
 *   控制论"信息-反馈律"：
 *     - 镜头列表 = 剧本结构的运行态实例（从 scenes/shots 派生）
 *     - 异步任务（视频）通过定时轮询将外部状态拉回到本地反馈环
 *     - 用户操作（生成首帧/视频）即刻反馈 UI，结果落库后供下一阶段读取
 *
 *  Prompt 增强策略：
 *    "${shot.description}, ${cameraAngle} shot, cinematic lighting,
 *     anime style, high quality, ${sceneDescription}"
 *    若有角色定妆描述，将拼入主体外观，提升一致性。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clapperboard,
  AlertTriangle,
  Layers,
  Activity,
  Sparkles,
} from 'lucide-react'
import { useProject } from '@/shared/contexts/ProjectContext'
import { useImageAI, useVideoAI } from '@/shared/hooks/useAI'
import { hasApiKey } from '@/config'
import { PhaseHeader } from '@/shared/components/PhaseHeader'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { Project, Scene, Shot, KeyframeData } from '@/types'
import { ShotCard } from './components/ShotCard'

const POLL_INTERVAL_MS = 5000

interface ShotEntry {
  scene: Scene
  shot: Shot
  sceneIndex: number
  shotIndexInScene: number
  globalIndex: number
}

function buildShotPrompt(project: Project, scene: Scene, shot: Shot): string {
  const description = shot.description?.trim() || '电影镜头'
  const cameraAngle = (shot.cameraAngle || 'medium').trim()
  const sceneDescription = scene.description?.trim() || ''
  const characterAppearance = project.script.characters
    .map(c => c.appearance?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')

  return [
    description,
    `${cameraAngle} shot`,
    'cinematic lighting',
    'anime style',
    'high quality',
    characterAppearance ? `featuring ${characterAppearance}` : null,
    sceneDescription ? `set in ${sceneDescription}` : null,
  ]
    .filter(Boolean)
    .join(', ')
}

export function DirectorPhase() {
  const { project, updateProject } = useProject()
  const imageAI = useImageAI()
  const videoAI = useVideoAI()

  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [globalErr, setGlobalErr] = useState<string | null>(null)

  // ---- Derived data ----
  const allEntries: ShotEntry[] = useMemo(() => {
    if (!project) return []
    let g = 0
    const list: ShotEntry[] = []
    project.script.scenes.forEach((scene, sIdx) => {
      scene.shots.forEach((shot, sxIdx) => {
        list.push({
          scene,
          shot,
          sceneIndex: sIdx,
          shotIndexInScene: sxIdx,
          globalIndex: g++,
        })
      })
    })
    return list
  }, [project])

  // ---- Stable updater for keyframe ----
  const writeKeyframe = useCallback(
    (shotId: string, patch: Partial<KeyframeData>) => {
      updateProject(p => ({
        ...p,
        director: {
          ...p.director,
          keyframes: {
            ...p.director.keyframes,
            [shotId]: {
              ...(p.director.keyframes[shotId] ?? {}),
              ...patch,
            },
          },
        },
      }))
    },
    [updateProject],
  )

  // ---- Keyframe generation ----
  const generateKeyframe = useCallback(
    async (entry: ShotEntry) => {
      if (!project) return
      if (!hasApiKey()) {
        throw new Error('请先在「模型配置」中配置 API Key')
      }
      const prompt = buildShotPrompt(project, entry.scene, entry.shot)
      const result = await imageAI.generate(prompt, {
        width: 1280,
        height: 720,
      })
      writeKeyframe(entry.shot.id, { startFrame: result.url })
    },
    [imageAI, project, writeKeyframe],
  )

  // ---- Video submission ----
  const generateVideo = useCallback(
    async (entry: ShotEntry) => {
      if (!project) return
      if (!hasApiKey()) {
        throw new Error('请先在「模型配置」中配置 API Key')
      }
      const keyframe = project.director.keyframes[entry.shot.id]
      if (!keyframe?.startFrame) {
        throw new Error('请先生成首帧')
      }
      // Optimistic: mark as pending
      writeKeyframe(entry.shot.id, {
        videoStatus: 'pending',
        videoUrl: undefined,
      })
      try {
        const result = await videoAI.submit({
          prompt: entry.shot.description,
          imageUrl: keyframe.startFrame,
          duration: entry.shot.duration,
        })
        writeKeyframe(entry.shot.id, {
          videoTaskId: result.taskId,
          videoStatus: result.status.state,
        })
      } catch (e) {
        writeKeyframe(entry.shot.id, { videoStatus: 'failed' })
        throw e
      }
    },
    [project, videoAI, writeKeyframe],
  )

  // ---- Batch keyframe ----
  const batchGenerateKeyframes = useCallback(async () => {
    if (!project || batchRunning) return
    const targets = allEntries.filter(
      e => !project.director.keyframes[e.shot.id]?.startFrame,
    )
    if (targets.length === 0) return
    setBatchRunning(true)
    setGlobalErr(null)
    setBatchProgress({ done: 0, total: targets.length })
    try {
      for (let i = 0; i < targets.length; i++) {
        try {
          await generateKeyframe(targets[i])
        } catch (e) {
          // 累积错误但不中断
          console.error('[Director] batch keyframe error', e)
          setGlobalErr(
            e instanceof Error ? e.message : '部分镜头生成失败',
          )
        } finally {
          setBatchProgress(p => ({ done: p.done + 1, total: p.total }))
        }
      }
    } finally {
      setBatchRunning(false)
      setBatchProgress({ done: 0, total: 0 })
    }
  }, [allEntries, batchRunning, generateKeyframe, project])

  // ---- Polling for video tasks ----
  // Use refs to keep latest values inside interval without re-creating it.
  const projectRef = useRef(project)
  const checkStatusRef = useRef(videoAI.checkStatus)
  useEffect(() => {
    projectRef.current = project
  }, [project])
  useEffect(() => {
    checkStatusRef.current = videoAI.checkStatus
  }, [videoAI.checkStatus])

  useEffect(() => {
    if (!project) return
    let cancelled = false

    const tick = async () => {
      const cur = projectRef.current
      if (!cur || cancelled) return
      const pendingTasks = Object.entries(cur.director.keyframes)
        .filter(
          ([, kf]) =>
            (kf.videoStatus === 'pending' || kf.videoStatus === 'processing') &&
            kf.videoTaskId,
        )
        .map(([shotId, kf]) => ({ shotId, taskId: kf.videoTaskId! }))

      if (pendingTasks.length === 0) return

      // Poll all in parallel; tolerate individual failures.
      await Promise.all(
        pendingTasks.map(async ({ shotId, taskId }) => {
          try {
            const status = await checkStatusRef.current(taskId)
            if (cancelled) return
            const patch: Partial<KeyframeData> = {
              videoStatus: status.state,
            }
            if (status.state === 'completed' && status.resultUrl) {
              patch.videoUrl = status.resultUrl
            }
            writeKeyframe(shotId, patch)
          } catch (e) {
            // Network error during polling — leave state untouched, will retry next tick
            console.warn('[Director] poll error', e)
          }
        }),
      )
    }

    // Run immediately so a freshly submitted task gets a fast first probe
    tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [project, writeKeyframe])

  if (!project) return null

  // ---- Stats ----
  const totalShots = allEntries.length
  const withFrame = allEntries.filter(
    e => project.director.keyframes[e.shot.id]?.startFrame,
  ).length
  const withVideo = allEntries.filter(
    e => project.director.keyframes[e.shot.id]?.videoStatus === 'completed',
  ).length
  const inFlight = allEntries.filter(e => {
    const s = project.director.keyframes[e.shot.id]?.videoStatus
    return s === 'pending' || s === 'processing'
  }).length

  const noApiKey = !hasApiKey()

  // Group entries by scene for render
  const grouped = project.script.scenes.map((scene, sIdx) => ({
    scene,
    sceneIndex: sIdx,
    items: allEntries.filter(e => e.scene.id === scene.id),
  }))

  return (
    <div className="px-10 lg:px-16 py-12 max-w-[1480px] mx-auto">
      <PhaseHeader phase="director" />

      <div className="rule mt-12 mb-10" />

      {/* Master control bar */}
      <section className="reveal-rise mb-10">
        <div className="surface-raised relative overflow-hidden">
          {/* atmospheric corner mark */}
          <div
            aria-hidden
            className="absolute -top-10 -right-10 w-48 h-48 opacity-40 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(212,165,116,0.18), transparent 70%)',
            }}
          />
          <div className="grid grid-cols-12 gap-6 p-7 items-center">
            <div className="col-span-12 md:col-span-7">
              <div
                className="mono text-[0.65rem] tracking-[0.22em] uppercase"
                style={{ color: 'var(--color-amber-leader)' }}
              >
                CONTROL ROOM · 调度台
              </div>
              <h2
                className="display text-[1.75rem] mt-1.5 tracking-tight"
                style={{ color: 'var(--color-paper-50)' }}
              >
                指挥每一颗镜头从首帧到运动
              </h2>
              <p
                className="text-[0.85rem] mt-2 leading-relaxed max-w-xl"
                style={{ color: 'var(--color-paper-400)' }}
              >
                先以图像模型生成首帧定调，再以视频模型让画面动起来。
                视频任务为异步，提交后将每 5 秒自动回询状态。
              </p>
            </div>

            <div className="col-span-12 md:col-span-5">
              <div className="grid grid-cols-4 gap-3">
                <Stat label="镜头" value={totalShots} />
                <Stat label="首帧" value={withFrame} accent />
                <Stat
                  label="渲染中"
                  value={inFlight}
                  pulse={inFlight > 0}
                />
                <Stat label="已成片" value={withVideo} highlight />
              </div>
              <div className="flex items-center justify-end gap-2.5 mt-4 flex-wrap">
                <button
                  onClick={batchGenerateKeyframes}
                  disabled={
                    batchRunning ||
                    totalShots === 0 ||
                    withFrame === totalShots ||
                    noApiKey
                  }
                  className="btn-ghost flex items-center gap-2"
                >
                  {batchRunning ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>
                        {batchProgress.done}/{batchProgress.total}
                      </span>
                    </>
                  ) : (
                    <>
                      <Layers size={12} strokeWidth={1.7} />
                      批量生成首帧
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Notices */}
          {noApiKey && (
            <div
              className="px-7 py-3 flex items-center gap-2.5 border-t mono text-[0.7rem] tracking-[0.12em] normal-case"
              style={{
                borderColor: 'var(--color-ink-700)',
                color: 'var(--color-crimson-mark)',
                background: 'rgba(200, 57, 44, 0.06)',
              }}
            >
              <AlertTriangle size={13} strokeWidth={1.7} />
              请先在右上角「模型配置」中填入 DashScope API Key 后再开始拍摄。
            </div>
          )}
          {globalErr && (
            <div
              className="px-7 py-3 flex items-center justify-between gap-2.5 border-t mono text-[0.7rem] tracking-[0.12em] normal-case"
              style={{
                borderColor: 'var(--color-ink-700)',
                color: 'var(--color-crimson-mark)',
                background: 'rgba(200, 57, 44, 0.06)',
              }}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle size={13} strokeWidth={1.7} />
                {globalErr}
              </span>
              <button
                onClick={() => setGlobalErr(null)}
                className="opacity-70 hover:opacity-100 uppercase tracking-[0.18em]"
              >
                关闭
              </button>
            </div>
          )}
          {batchRunning && batchProgress.total > 0 && (
            <div
              className="h-px relative overflow-hidden"
              style={{ background: 'var(--color-ink-700)' }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${(batchProgress.done / batchProgress.total) * 100}%`,
                  background:
                    'linear-gradient(90deg, var(--color-amber-deep), var(--color-amber-leader))',
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Shot board */}
      <section className="reveal-rise" style={{ animationDelay: '120ms' }}>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div className="flex items-end gap-3">
            <Clapperboard
              size={18}
              strokeWidth={1.4}
              className="mb-1.5"
              style={{ color: 'var(--color-amber-leader)' }}
            />
            <div>
              <div
                className="display text-2xl tracking-tight"
                style={{ color: 'var(--color-paper-50)' }}
              >
                拍摄板
              </div>
              <div
                className="mono text-[0.62rem] tracking-[0.22em] uppercase mt-1"
                style={{ color: 'var(--color-paper-500)' }}
              >
                SHOT BOARD · {String(totalShots).padStart(2, '0')} TAKES
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-4 mono text-[0.62rem] tracking-[0.18em] uppercase"
            style={{ color: 'var(--color-paper-500)' }}
          >
            <Legend label="未开拍" color="var(--color-paper-500)" />
            <Legend label="渲染中" color="var(--color-crimson-mark)" pulse />
            <Legend label="已完成" color="var(--color-amber-leader)" />
          </div>
        </div>

        {totalShots === 0 ? (
          <div className="surface px-6 py-20 text-center">
            <Clapperboard
              size={32}
              strokeWidth={0.9}
              className="mx-auto mb-3"
              style={{ color: 'var(--color-paper-500)' }}
            />
            <div
              className="display italic text-2xl"
              style={{ color: 'var(--color-paper-200)' }}
            >
              拍摄板空白
            </div>
            <div
              className="text-xs mt-1.5 mono tracking-[0.16em] uppercase"
              style={{ color: 'var(--color-paper-500)' }}
            >
              请先在 Phase 01 生成镜头
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(g => (
              <SceneGroup
                key={g.scene.id}
                title={g.scene.title}
                description={g.scene.description}
                index={g.sceneIndex}
                count={g.items.length}
              >
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {g.items.map(entry => (
                    <ShotCard
                      key={entry.shot.id}
                      index={entry.globalIndex}
                      sceneTitle={entry.scene.title}
                      sceneIndex={entry.sceneIndex}
                      shotIndexInScene={entry.shotIndexInScene}
                      shot={entry.shot}
                      keyframe={project.director.keyframes[entry.shot.id]}
                      onGenerateKeyframe={() => generateKeyframe(entry)}
                      onGenerateVideo={() => generateVideo(entry)}
                    />
                  ))}
                </div>
              </SceneGroup>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  highlight,
  pulse,
}: {
  label: string
  value: number
  accent?: boolean
  highlight?: boolean
  pulse?: boolean
}) {
  const color = highlight
    ? 'var(--color-amber-leader)'
    : accent
    ? 'var(--color-paper-50)'
    : pulse
    ? 'var(--color-crimson-mark)'
    : 'var(--color-paper-200)'
  return (
    <div
      className="px-3 py-2.5 border"
      style={{
        borderColor: 'var(--color-ink-700)',
        background: 'var(--color-ink-900)',
      }}
    >
      <div
        className="mono text-[0.55rem] tracking-[0.22em] uppercase flex items-center gap-1"
        style={{ color: 'var(--color-paper-500)' }}
      >
        {pulse && value > 0 && (
          <Activity size={9} strokeWidth={1.8}
                    style={{ color: 'var(--color-crimson-mark)' }} />
        )}
        {label}
      </div>
      <div className="display text-2xl mt-0.5 tracking-tight" style={{ color }}>
        {String(value).padStart(2, '0')}
      </div>
    </div>
  )
}

function Legend({
  label,
  color,
  pulse,
}: { label: string; color: string; pulse?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{
          background: color,
          animation: pulse ? 'pulse-rec 1.6s ease-in-out infinite' : undefined,
        }}
      />
      {label}
    </span>
  )
}

function SceneGroup({
  title,
  description,
  index,
  count,
  children,
}: {
  title: string
  description: string
  index: number
  count: number
  children: React.ReactNode
}) {
  return (
    <div>
      <header className="flex items-end justify-between gap-6 flex-wrap mb-4">
        <div className="flex items-end gap-4 min-w-0">
          <div
            className="phase-numeral leading-none text-3xl"
            style={{ color: 'var(--color-amber-deep)' }}
          >
            {String(index + 1).padStart(2, '0')}
          </div>
          <div className="min-w-0">
            <div
              className="mono text-[0.6rem] tracking-[0.22em] uppercase"
              style={{ color: 'var(--color-paper-500)' }}
            >
              SCENE · {String(count).padStart(2, '0')} SHOT
              {count > 1 ? 'S' : ''}
            </div>
            <div
              className="display text-xl tracking-tight truncate"
              style={{ color: 'var(--color-paper-50)' }}
            >
              {title || '未命名场景'}
            </div>
            {description && (
              <div
                className="text-[0.78rem] mt-1 max-w-2xl line-clamp-1 italic"
                style={{ color: 'var(--color-paper-400)' }}
              >
                {description}
              </div>
            )}
          </div>
        </div>
        <Sparkles
          size={14}
          strokeWidth={1.4}
          className="opacity-60 mb-1.5"
          style={{ color: 'var(--color-amber-deep)' }}
        />
      </header>
      <div
        className="rule mb-5"
        style={{ borderColor: 'var(--color-ink-700)' }}
      />
      {children}
    </div>
  )
}

