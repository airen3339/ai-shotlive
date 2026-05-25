/**
 * ExportStats — 成片导出统计面板
 *   总镜头 / 已成片 / 剩余 / 预估总时长
 */
import type { ReactNode } from 'react'
import { Clock, Film, Hourglass, CheckCircle2 } from 'lucide-react'

interface Props {
  totalShots: number
  completedVideos: number
  inFlight: number
  totalDurationSeconds: number
}

function formatDuration(s: number): { value: string; unit: string } {
  if (!s) return { value: '00', unit: 'sec' }
  if (s < 60) return { value: String(s).padStart(2, '0'), unit: 'sec' }
  const m = Math.floor(s / 60)
  const sec = s % 60
  return { value: `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`, unit: 'min' }
}

export function ExportStats({
  totalShots,
  completedVideos,
  inFlight,
  totalDurationSeconds,
}: Props) {
  const { value: durValue, unit: durUnit } = formatDuration(totalDurationSeconds)
  const completionPct = totalShots > 0
    ? Math.round((completedVideos / totalShots) * 100)
    : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card
        icon={<Film size={13} strokeWidth={1.5} />}
        label="镜头总数"
        sub="TOTAL TAKES"
        value={String(totalShots).padStart(2, '0')}
      />
      <Card
        icon={<CheckCircle2 size={13} strokeWidth={1.5} />}
        label="已成片"
        sub="PRINTED"
        value={String(completedVideos).padStart(2, '0')}
        highlight
      />
      <Card
        icon={<Hourglass size={13} strokeWidth={1.5} />}
        label="渲染中 / 待渲染"
        sub="IN FLIGHT"
        value={String(inFlight).padStart(2, '0')}
        warning={inFlight > 0}
      />
      <Card
        icon={<Clock size={13} strokeWidth={1.5} />}
        label="预估总时长"
        sub={durUnit === 'min' ? 'TOTAL · MM:SS' : 'TOTAL · SEC'}
        value={durValue}
        unit={durUnit === 'sec' ? 's' : ''}
      />
      <div className="col-span-2 md:col-span-4">
        <div className="flex items-center justify-between mono text-[0.6rem] tracking-[0.2em] uppercase mb-1.5"
             style={{ color: 'var(--color-paper-500)' }}>
          <span>完成度 · COMPLETION</span>
          <span style={{ color: 'var(--color-amber-leader)' }}>
            {completionPct}%
          </span>
        </div>
        <div
          className="h-px relative overflow-hidden"
          style={{ background: 'var(--color-ink-700)' }}
        >
          <div
            className="absolute inset-y-0 left-0 transition-all duration-700"
            style={{
              width: `${completionPct}%`,
              background:
                'linear-gradient(90deg, var(--color-amber-deep), var(--color-amber-leader))',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Card({
  icon,
  label,
  sub,
  value,
  unit,
  highlight,
  warning,
}: {
  icon: ReactNode
  label: string
  sub: string
  value: string
  unit?: string
  highlight?: boolean
  warning?: boolean
}) {
  const valueColor = highlight
    ? 'var(--color-amber-leader)'
    : warning
    ? 'var(--color-crimson-mark)'
    : 'var(--color-paper-50)'
  return (
    <div
      className="px-4 py-3 border"
      style={{
        borderColor: 'var(--color-ink-700)',
        background: 'var(--color-ink-900)',
      }}
    >
      <div
        className="flex items-center gap-1.5 mono text-[0.58rem] tracking-[0.2em] uppercase"
        style={{ color: 'var(--color-paper-500)' }}
      >
        <span style={{ color: 'var(--color-amber-deep)' }}>{icon}</span>
        {sub}
      </div>
      <div
        className="display text-[2rem] tracking-tight leading-none mt-1.5"
        style={{ color: valueColor }}
      >
        {value}
        {unit && (
          <span className="text-[0.85rem] align-top ml-0.5" style={{ color: 'var(--color-paper-400)' }}>
            {unit}
          </span>
        )}
      </div>
      <div
        className="text-[0.72rem] mt-0.5"
        style={{ color: 'var(--color-paper-400)' }}
      >
        {label}
      </div>
    </div>
  )
}
