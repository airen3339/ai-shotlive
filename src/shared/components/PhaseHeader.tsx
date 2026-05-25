/**
 * PhaseHeader — 章节统一片头
 *   编号大字 + 中文标题 + 英文副标题 + 状态条
 */
import type { Phase } from '@/types'
import { useProject } from '@/shared/contexts/ProjectContext'
import { workflowEngine } from '@/services/workflow'
import { ArrowRight } from 'lucide-react'

const META: Record<Phase, { number: string; title: string; subtitle: string; tagline: string }> = {
  script:   { number: '01', title: '剧本分析',   subtitle: 'Screenplay',     tagline: 'Decompose story into scenes & shots.' },
  assets:   { number: '02', title: '资产生成',   subtitle: 'Production Art', tagline: 'Cast the characters, paint the world.' },
  director: { number: '03', title: '导演工作台', subtitle: 'Direction',      tagline: 'Frame, motion, take. Roll camera.' },
  export:   { number: '04', title: '成片导出',   subtitle: 'Final Cut',      tagline: 'Print the master. Ship the film.' },
}

export function PhaseHeader({ phase }: { phase: Phase }) {
  const meta = META[phase]
  const { project, setPhase } = useProject()
  if (!project) return null

  const status = workflowEngine.getPhaseStatus(project, phase)
  const next = workflowEngine.getNextPhase(phase)
  // 进入下一章 = 当前章节已完成（前序章节必然已完成才能到达此处）
  const canAdvance = Boolean(next && status.isComplete)

  return (
    <header className="reveal-rise">
      <div className="flex items-end justify-between gap-8 flex-wrap">
        <div className="flex items-end gap-7">
          <div className="phase-numeral leading-none"
               style={{ fontSize: 'clamp(5rem, 11vw, 9rem)', color: 'var(--color-amber-leader)' }}>
            {meta.number}
          </div>
          <div className="pb-3">
            <div className="mono text-[0.7rem] tracking-[0.28em] uppercase mb-2"
                 style={{ color: 'var(--color-paper-500)' }}>
              CHAPTER · {meta.subtitle}
            </div>
            <h1 className="display tracking-[-0.02em] leading-tight"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--color-paper-50)' }}>
              {meta.title}
            </h1>
            <div className="mono text-[0.72rem] tracking-[0.12em] mt-2 italic"
                 style={{ color: 'var(--color-amber-deep)' }}>
              {meta.tagline}
            </div>
          </div>
        </div>

        {/* Right: status + advance */}
        <div className="pb-2 flex items-center gap-6">
          <div className="text-right">
            <div className="mono text-[0.65rem] tracking-[0.2em] uppercase"
                 style={{ color: 'var(--color-paper-500)' }}>
              进度 · COMPLETION
            </div>
            <div className="display text-3xl mt-1"
                 style={{ color: status.isComplete ? 'var(--color-amber-leader)' : 'var(--color-paper-200)' }}>
              {status.completionPercentage}<span className="text-base align-top">%</span>
            </div>
          </div>
          {next && (
            <button
              onClick={() => canAdvance && setPhase(next)}
              disabled={!canAdvance}
              className={canAdvance ? 'btn-amber' : 'btn-ghost'}
            >
              下一章 · NEXT
              <ArrowRight size={13} strokeWidth={1.8} className="inline ml-2" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-8 h-px w-full relative overflow-hidden"
           style={{ background: 'var(--color-ink-700)' }}>
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700"
          style={{
            width: `${status.completionPercentage}%`,
            background: 'linear-gradient(90deg, var(--color-amber-deep), var(--color-amber-leader))',
          }}
        />
      </div>

      {/* Missing requirements (if any) */}
      {status.missingRequirements.length > 0 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className="mono text-[0.65rem] tracking-[0.2em] uppercase"
                style={{ color: 'var(--color-crimson-mark)' }}>
            待完成
          </span>
          {status.missingRequirements.map((m, i) => (
            <span key={i} className="mono text-[0.7rem]"
                  style={{ color: 'var(--color-paper-400)' }}>
              {m}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}
