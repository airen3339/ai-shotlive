/**
 * Sidebar — 编辑室胶片导航
 *   左侧灯条状结构，每一格都是一个 Phase 章节，
 *   带有完成度标记和编号。
 */
import { useState } from 'react'
import {
  FileText,
  Images,
  Film,
  PackageOpen,
  Settings,
  ChevronLeft,
  Check,
  Lock,
} from 'lucide-react'
import type { Phase } from '@/types'
import { useProject } from '@/shared/contexts/ProjectContext'
import { workflowEngine } from '@/services/workflow'
import { ApiKeyModal } from '@/shared/components/ApiKeyModal'
import { hasApiKey } from '@/config'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

interface PhaseMeta {
  id: Phase
  number: string
  title: string
  subtitle: string
  Icon: typeof FileText
}

const PHASES: PhaseMeta[] = [
  { id: 'script',   number: '01', title: '剧本分析', subtitle: 'Screenplay',     Icon: FileText },
  { id: 'assets',   number: '02', title: '资产生成', subtitle: 'Production Art', Icon: Images },
  { id: 'director', number: '03', title: '导演工作台', subtitle: 'Direction',    Icon: Film },
  { id: 'export',   number: '04', title: '成片导出', subtitle: 'Final Cut',      Icon: PackageOpen },
]

export function Sidebar() {
  const {
    project, currentPhase, setPhase,
    closeProject, isSaving,
  } = useProject()
  const [apiOpen, setApiOpen] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(hasApiKey())

  if (!project) return null

  return (
    <aside className="w-72 shrink-0 border-r flex flex-col"
           style={{ borderColor: 'var(--color-ink-600)', background: 'var(--color-ink-900)' }}>
      {/* Header — 项目标题与切换 */}
      <div className="px-6 pt-7 pb-5">
        <button
          onClick={closeProject}
          className="mono text-[0.65rem] tracking-[0.22em] uppercase text-paper-400 hover:text-amber-glow flex items-center gap-1.5 mb-4 transition-colors"
          style={{ color: 'var(--color-paper-400)' }}
        >
          <ChevronLeft size={12} strokeWidth={1.6} /> 返回项目库
        </button>
        <div className="display text-[1.55rem] leading-tight tracking-tight"
             style={{ color: 'var(--color-paper-50)' }}>
          {project.name}
        </div>
        <div className="mono text-[0.62rem] tracking-[0.2em] uppercase text-paper-500 mt-2 truncate"
             style={{ color: 'var(--color-paper-500)' }}>
          ID · {project.id.slice(0, 8)}
        </div>
      </div>

      <div className="rule mx-6" />

      {/* Section label */}
      <div className="px-6 pt-6 pb-3 flex items-center justify-between">
        <span className="label">章节 · CHAPTERS</span>
        <span className="label" style={{ color: 'var(--color-amber-leader)' }}>
          {PHASES.findIndex(p => p.id === currentPhase) + 1}/4
        </span>
      </div>

      {/* Phase list */}
      <nav className="flex-1 px-3 pb-4">
        {PHASES.map((meta) => {
          const status = workflowEngine.getPhaseStatus(project, meta.id)
          const reachable = workflowEngine.canAdvanceTo(project, meta.id)
          const isActive = currentPhase === meta.id
          const isDone = status.isComplete
          const Icon = meta.Icon

          return (
            <button
              key={meta.id}
              disabled={!reachable}
              onClick={() => reachable && setPhase(meta.id)}
              className="group w-full text-left relative px-3 py-3.5 transition-all flex items-start gap-3"
              style={{
                background: isActive ? 'var(--color-ink-800)' : 'transparent',
                cursor: reachable ? 'pointer' : 'not-allowed',
                opacity: reachable ? 1 : 0.45,
              }}
            >
              {/* Active marker — left amber bar */}
              <span
                className="absolute left-0 top-3.5 bottom-3.5 w-[2px] transition-all"
                style={{
                  background: isActive ? 'var(--color-amber-leader)' : 'transparent',
                  boxShadow: isActive ? '0 0 16px var(--color-amber-leader)' : 'none',
                }}
              />

              {/* Phase numeral */}
              <div className="phase-numeral text-2xl w-9 shrink-0 mt-0.5"
                   style={{
                     color: isActive
                       ? 'var(--color-amber-leader)'
                       : isDone
                         ? 'var(--color-amber-deep)'
                         : 'var(--color-paper-500)',
                   }}>
                {meta.number}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon
                    size={13}
                    strokeWidth={1.4}
                    style={{
                      color: isActive ? 'var(--color-paper-50)' : 'var(--color-paper-400)',
                    }}
                  />
                  <span className="font-medium text-[0.95rem] truncate"
                        style={{
                          color: isActive ? 'var(--color-paper-50)' : 'var(--color-paper-200)',
                        }}>
                    {meta.title}
                  </span>
                </div>
                <div className="mono text-[0.62rem] tracking-[0.16em] uppercase mt-0.5"
                     style={{ color: 'var(--color-paper-500)' }}>
                  {meta.subtitle} · {status.completionPercentage}%
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-px w-full relative overflow-hidden"
                     style={{ background: 'var(--color-ink-700)' }}>
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-500"
                    style={{
                      width: `${status.completionPercentage}%`,
                      background: isActive
                        ? 'var(--color-amber-leader)'
                        : isDone
                          ? 'var(--color-amber-deep)'
                          : 'var(--color-paper-500)',
                    }}
                  />
                </div>
              </div>

              {/* Status badge */}
              <span className="shrink-0 mt-1">
                {!reachable ? (
                  <Lock size={12} strokeWidth={1.6} style={{ color: 'var(--color-paper-500)' }} />
                ) : isDone ? (
                  <Check size={14} strokeWidth={1.8} style={{ color: 'var(--color-amber-leader)' }} />
                ) : isActive ? (
                  <span className="tick tick-rec" />
                ) : (
                  <span className="tick" />
                )}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Footer — settings + save indicator */}
      <div className="border-t px-6 py-4 flex items-center justify-between"
           style={{ borderColor: 'var(--color-ink-600)' }}>
        <button
          onClick={() => setApiOpen(true)}
          className="flex items-center gap-2 mono text-[0.65rem] tracking-[0.18em] uppercase transition-colors hover:text-amber-glow"
          style={{ color: apiConfigured ? 'var(--color-paper-400)' : 'var(--color-crimson-mark)' }}
        >
          <Settings size={13} strokeWidth={1.4} />
          API · {apiConfigured ? '已配置' : '未配置'}
        </button>

        <div className="flex items-center gap-2">
          {isSaving ? (
            <LoadingSpinner size="sm" label="存档中" />
          ) : (
            <span className="flex items-center gap-2">
              <span className="tick" style={{ background: 'var(--color-amber-deep)' }} />
              <span className="mono text-[0.62rem] tracking-[0.18em] uppercase"
                    style={{ color: 'var(--color-paper-500)' }}>
                已存档
              </span>
            </span>
          )}
        </div>
      </div>

      <ApiKeyModal
        open={apiOpen}
        onClose={() => {
          setApiOpen(false)
          setApiConfigured(hasApiKey())
        }}
      />
    </aside>
  )
}
