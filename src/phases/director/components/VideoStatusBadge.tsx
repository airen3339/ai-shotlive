/**
 * VideoStatusBadge — 视频任务状态徽标
 *   pending / processing / completed / failed 四态视觉编码
 *   配合摄影机录制灯（红）与片尾酒色（琥珀）传达节奏
 */
import { CheckCircle2, AlertTriangle, Loader2, Hourglass } from 'lucide-react'
import type { KeyframeData } from '@/types'

type Status = NonNullable<KeyframeData['videoStatus']>

const META: Record<Status, {
  label: string
  short: string
  color: string
  bg: string
  Icon: typeof CheckCircle2
  pulse?: boolean
}> = {
  pending: {
    label: '排队', short: 'QUEUED',
    color: 'var(--color-paper-200)',
    bg: 'rgba(139, 134, 118, 0.18)',
    Icon: Hourglass,
  },
  processing: {
    label: '渲染中', short: 'RENDERING',
    color: 'var(--color-crimson-mark)',
    bg: 'rgba(200, 57, 44, 0.16)',
    Icon: Loader2,
    pulse: true,
  },
  completed: {
    label: '已完成', short: 'PRINTED',
    color: 'var(--color-amber-leader)',
    bg: 'rgba(212, 165, 116, 0.14)',
    Icon: CheckCircle2,
  },
  failed: {
    label: '失败', short: 'FAILED',
    color: 'var(--color-crimson-mark)',
    bg: 'rgba(200, 57, 44, 0.12)',
    Icon: AlertTriangle,
  },
}

interface Props {
  status?: Status
  progress?: number
  compact?: boolean
}

export function VideoStatusBadge({ status, progress, compact }: Props) {
  if (!status) return null
  const m = META[status]
  const { Icon } = m
  const showProgress = status === 'processing' && typeof progress === 'number'

  return (
    <span
      className="inline-flex items-center gap-1.5 mono uppercase tracking-[0.16em] px-2 py-1"
      style={{
        background: m.bg,
        color: m.color,
        fontSize: compact ? '0.55rem' : '0.62rem',
        border: `1px solid ${m.color === 'var(--color-amber-leader)' ? 'rgba(212,165,116,0.35)' : m.color === 'var(--color-crimson-mark)' ? 'rgba(200,57,44,0.35)' : 'rgba(139,134,118,0.3)'}`,
      }}
    >
      <Icon
        size={compact ? 9 : 11}
        strokeWidth={1.8}
        className={m.pulse ? 'animate-spin' : ''}
        style={m.pulse ? { animationDuration: '1.4s' } : undefined}
      />
      {compact ? m.short : m.label}
      {showProgress && (
        <span style={{ opacity: 0.7 }}>· {Math.round(progress!)}%</span>
      )}
    </span>
  )
}
