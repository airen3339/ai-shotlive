/**
 * Phase 04 · 成片导出 ExportPhase
 *   控制论"信息-反馈律"：
 *     - 仅展示已"完成态"的视频片段（videoStatus === 'completed' 且 videoUrl 有值）
 *     - 单片段下载与项目数据导出彼此独立，互不阻塞
 *     - 项目导出仅含文本/元数据，不嵌入二进制（图像/视频URL本身保留）
 */
import { useMemo, useState } from 'react'
import {
  Download,
  Film,
  Package,
  FileJson,
  AlertCircle,
} from 'lucide-react'
import { useProject } from '@/shared/contexts/ProjectContext'
import { PhaseHeader } from '@/shared/components/PhaseHeader'
import type { Project, Scene, Shot, KeyframeData } from '@/types'
import { VideoCard } from './components/VideoCard'
import { ExportStats } from './components/ExportStats'

interface ShotEntry {
  scene: Scene
  shot: Shot
  sceneIndex: number
  shotIndexInScene: number
  globalIndex: number
  keyframe?: KeyframeData
}

function safeFileName(s: string): string {
  return (s || 'project')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

function buildShotFileName(
  projectName: string,
  sceneIndex: number,
  shotIndex: number,
): string {
  const base = safeFileName(projectName)
  const sc = String(sceneIndex + 1).padStart(2, '0')
  const sh = String(shotIndex + 1).padStart(2, '0')
  return `${base}_scene${sc}_shot${sh}.mp4`
}

function buildProjectExport(project: Project) {
  // 文本/元数据快照：仅留视频/图像URL，不内联二进制。
  return {
    schema: 'cinegen-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      currentPhase: project.currentPhase,
      script: project.script,
      // assets/director 中的值多为 URL 或 base64 dataURL；
      // 文本导出中保留可恢复的引用，但不嵌入 base64 数据。
      assets: stripDataUrls(project.assets),
      director: stripDataUrls(project.director),
      export: project.export,
    },
  }
}

function stripDataUrls<T>(input: T): T {
  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (typeof value === 'string' && value.startsWith('data:')) {
        return '__inline_binary_omitted__'
      }
      return value
    }),
  ) as T
}

export function ExportPhase() {
  const { project } = useProject()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // 收集所有镜头条目（含完成态判定）
  const allEntries = useMemo<ShotEntry[]>(() => {
    if (!project) return []
    const list: ShotEntry[] = []
    let g = 0
    project.script.scenes.forEach((scene, sIdx) => {
      scene.shots.forEach((shot, sxIdx) => {
        list.push({
          scene,
          shot,
          sceneIndex: sIdx,
          shotIndexInScene: sxIdx,
          globalIndex: g++,
          keyframe: project.director.keyframes[shot.id],
        })
      })
    })
    return list
  }, [project])

  if (!project) return null

  const completedEntries = allEntries.filter(
    e => e.keyframe?.videoStatus === 'completed' && e.keyframe?.videoUrl,
  )
  const inFlight = allEntries.filter(e => {
    const s = e.keyframe?.videoStatus
    return s === 'pending' || s === 'processing'
  }).length

  // 估算时长：每个镜头优先用 shot.duration，否则按 5s 估算
  const totalDuration = completedEntries.reduce(
    (acc, e) => acc + (e.shot.duration ?? 5),
    0,
  )

  // 按场景分组渲染
  const grouped = project.script.scenes
    .map((scene, sIdx) => ({
      scene,
      sceneIndex: sIdx,
      items: completedEntries.filter(e => e.scene.id === scene.id),
    }))
    .filter(g => g.items.length > 0)

  const handleProjectExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const data = buildProjectExport(project)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.download = `${safeFileName(project.name)}_${ts}.cinegen.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '项目数据导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="px-10 lg:px-16 py-12 max-w-[1320px] mx-auto">
      <PhaseHeader phase="export" />

      <div className="rule mt-12 mb-10" />

      {/* Master · Print Slip */}
      <section className="reveal-rise mb-10">
        <div className="surface-raised relative overflow-hidden">
          {/* edge marker */}
          <div
            aria-hidden
            className="absolute -top-12 -left-12 w-56 h-56 opacity-50 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(212,165,116,0.18), transparent 70%)',
            }}
          />
          {/* sprocket-hole accent */}
          <div
            aria-hidden
            className="absolute top-0 right-0 h-full w-2 flex flex-col gap-2 py-3 pr-1.5 pointer-events-none"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="block flex-1 w-full rounded-sm"
                style={{
                  background:
                    i % 2 === 0
                      ? 'var(--color-ink-700)'
                      : 'transparent',
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-12 gap-6 p-7 items-center">
            <div className="col-span-12 md:col-span-7">
              <div
                className="mono text-[0.65rem] tracking-[0.22em] uppercase"
                style={{ color: 'var(--color-amber-leader)' }}
              >
                MASTER PRINT · 主拷贝
              </div>
              <h2
                className="display text-[1.85rem] mt-1.5 tracking-tight leading-tight"
                style={{ color: 'var(--color-paper-50)' }}
              >
                把所有镜头封进一只胶卷盒里
              </h2>
              <p
                className="text-[0.85rem] mt-2 leading-relaxed max-w-xl"
                style={{ color: 'var(--color-paper-400)' }}
              >
                每个镜头单独存档，逐段下载即可在本机离线编辑；
                同时可将整个项目（含剧本结构、镜头索引）导出为可读 JSON，
                便于备份、迁移或回流到其它工具链。
              </p>
            </div>

            <div className="col-span-12 md:col-span-5 flex flex-col items-stretch md:items-end gap-3">
              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                <button
                  onClick={handleProjectExport}
                  disabled={exporting}
                  className="btn-ghost flex items-center gap-2 disabled:opacity-50"
                >
                  <FileJson size={12} strokeWidth={1.7} />
                  {exporting ? '正在打包…' : '导出项目数据 · JSON'}
                </button>
                <button
                  disabled={completedEntries.length === 0}
                  className="btn-amber flex items-center gap-2"
                  title={
                    completedEntries.length === 0
                      ? '尚无已完成视频可拼接'
                      : '逐段下载或外部拼接'
                  }
                >
                  <Package size={13} strokeWidth={1.7} />
                  {completedEntries.length === 0
                    ? '暂无可导出片段'
                    : `${completedEntries.length} 段 · 等待拼接`}
                </button>
              </div>
            </div>
          </div>

          {exportError && (
            <div
              className="px-7 py-3 flex items-center justify-between gap-2.5 border-t mono text-[0.7rem] tracking-[0.12em] normal-case"
              style={{
                borderColor: 'var(--color-ink-700)',
                color: 'var(--color-crimson-mark)',
                background: 'rgba(200, 57, 44, 0.06)',
              }}
            >
              <span className="flex items-center gap-2">
                <AlertCircle size={13} strokeWidth={1.7} />
                {exportError}
              </span>
              <button
                onClick={() => setExportError(null)}
                className="opacity-70 hover:opacity-100 uppercase tracking-[0.18em]"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="reveal-rise mb-10" style={{ animationDelay: '80ms' }}>
        <ExportStats
          totalShots={allEntries.length}
          completedVideos={completedEntries.length}
          inFlight={inFlight}
          totalDurationSeconds={totalDuration}
        />
      </section>

      {/* Segments */}
      <section className="reveal-rise" style={{ animationDelay: '160ms' }}>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div className="flex items-end gap-3">
            <Film
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
                片段档案
              </div>
              <div
                className="mono text-[0.62rem] tracking-[0.22em] uppercase mt-1"
                style={{ color: 'var(--color-paper-500)' }}
              >
                SEGMENTS · INDIVIDUAL TAKES ·{' '}
                {String(completedEntries.length).padStart(2, '0')}
              </div>
            </div>
          </div>
          {completedEntries.length > 0 && (
            <div
              className="mono text-[0.62rem] tracking-[0.18em] uppercase flex items-center gap-2"
              style={{ color: 'var(--color-paper-500)' }}
            >
              <Download size={11} strokeWidth={1.6} />
              逐段下载 · MP4
            </div>
          )}
        </div>

        {completedEntries.length === 0 ? (
          <div className="surface px-6 py-20 text-center">
            <Film
              size={32}
              strokeWidth={0.9}
              className="mx-auto mb-3"
              style={{ color: 'var(--color-paper-500)' }}
            />
            <div
              className="display italic text-2xl"
              style={{ color: 'var(--color-paper-200)' }}
            >
              还没有任何成片
            </div>
            <div
              className="text-xs mt-1.5 mono tracking-[0.16em] uppercase"
              style={{ color: 'var(--color-paper-500)' }}
            >
              请先在 Phase 03 完成至少一个镜头的拍摄
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(g => (
              <div key={g.scene.id}>
                <header className="flex items-end justify-between gap-6 flex-wrap mb-4">
                  <div className="flex items-end gap-4 min-w-0">
                    <div
                      className="phase-numeral leading-none text-3xl"
                      style={{ color: 'var(--color-amber-deep)' }}
                    >
                      {String(g.sceneIndex + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="mono text-[0.6rem] tracking-[0.22em] uppercase"
                        style={{ color: 'var(--color-paper-500)' }}
                      >
                        SCENE · {String(g.items.length).padStart(2, '0')} CLIP
                        {g.items.length > 1 ? 'S' : ''}
                      </div>
                      <div
                        className="display text-xl tracking-tight truncate"
                        style={{ color: 'var(--color-paper-50)' }}
                      >
                        {g.scene.title || '未命名场景'}
                      </div>
                    </div>
                  </div>
                  <span
                    className="mono text-[0.62rem] tracking-[0.18em] uppercase"
                    style={{ color: 'var(--color-amber-deep)' }}
                  >
                    {g.items.reduce(
                      (acc, it) => acc + (it.shot.duration ?? 5),
                      0,
                    )}
                    s
                  </span>
                </header>
                <div
                  className="rule mb-5"
                  style={{ borderColor: 'var(--color-ink-700)' }}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {g.items.map(entry => (
                    <VideoCard
                      key={entry.shot.id}
                      index={entry.globalIndex}
                      sceneIndex={entry.sceneIndex}
                      shotIndexInScene={entry.shotIndexInScene}
                      sceneTitle={entry.scene.title}
                      shotDescription={entry.shot.description}
                      cameraAngle={entry.shot.cameraAngle}
                      duration={entry.shot.duration}
                      posterUrl={entry.keyframe?.startFrame}
                      videoUrl={entry.keyframe!.videoUrl!}
                      fileName={buildShotFileName(
                        project.name,
                        entry.sceneIndex,
                        entry.shotIndexInScene,
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
