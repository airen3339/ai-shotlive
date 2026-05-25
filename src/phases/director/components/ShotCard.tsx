/**
 * ShotCard — 镜头卡片（导演工作台）
 *   编号场记板 + 首帧预览 + 状态徽标 + 拍摄/重拍操作
 */
import { useState } from 'react'
import { Camera, Wand2, Film, RefreshCw, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { VideoStatusBadge } from './VideoStatusBadge'
import type { KeyframeData, Shot } from '@/types'

interface Props {
  index: number
  sceneTitle: string
  sceneIndex: number
  shotIndexInScene: number
  shot: Shot
  keyframe?: KeyframeData
  onGenerateKeyframe: () => Promise<void> | void
  onGenerateVideo: () => Promise<void> | void
}

export function ShotCard({
  index,
  sceneTitle,
  sceneIndex,
  shotIndexInScene,
  shot,
  keyframe,
  onGenerateKeyframe,
  onGenerateVideo,
}: Props) {
  const [busyKey, setBusyKey] = useState(false)
  const [busyVid, setBusyVid] = useState(false)
  const [openErr, setOpenErr] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const status = keyframe?.videoStatus
  const hasFrame = Boolean(keyframe?.startFrame)
  const hasVideo = status === 'completed' && Boolean(keyframe?.videoUrl)
  const isLocked =
    status === 'pending' || status === 'processing' || busyVid

  const handleKey = async () => {
    if (busyKey) return
    setBusyKey(true)
    setErr(null)
    try {
      await onGenerateKeyframe()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成失败')
      setOpenErr(true)
    } finally {
      setBusyKey(false)
    }
  }

  const handleVideo = async () => {
    if (busyVid || isLocked) return
    setBusyVid(true)
    setErr(null)
    try {
      await onGenerateVideo()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失败')
      setOpenErr(true)
    } finally {
      setBusyVid(false)
    }
  }

  return (
    <article
      className="surface group relative overflow-hidden flex flex-col transition-colors"
      style={{
        outline: status === 'completed' ? '1px solid var(--color-amber-deep)' : undefined,
      }}
    >
      {/* Top: slate row */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          borderColor: 'var(--color-ink-700)',
          background: 'var(--color-ink-900)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="phase-numeral leading-none text-2xl"
            style={{ color: 'var(--color-amber-leader)' }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <div
              className="mono text-[0.6rem] tracking-[0.18em] uppercase truncate"
              style={{ color: 'var(--color-paper-500)' }}
            >
              SC {String(sceneIndex + 1).padStart(2, '0')}
              <span className="mx-1.5 opacity-40">·</span>
              SHOT {String(shotIndexInScene + 1).padStart(2, '0')}
            </div>
            <div
              className="text-[0.78rem] truncate"
              style={{ color: 'var(--color-paper-100)' }}
            >
              {sceneTitle || '未命名场景'}
            </div>
          </div>
        </div>
        <VideoStatusBadge
          status={status}
          progress={status === 'processing' ? 50 : undefined}
          compact
        />
      </div>

      {/* Frame preview */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ background: 'var(--color-ink-950)' }}
      >
        {keyframe?.startFrame ? (
          <img
            src={keyframe.startFrame}
            alt={`镜头 ${index + 1} 首帧`}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{
              background:
                'repeating-linear-gradient(135deg, var(--color-ink-900) 0 14px, var(--color-ink-850) 14px 28px)',
            }}
          >
            <Camera
              size={20}
              strokeWidth={1.1}
              style={{ color: 'var(--color-paper-500)' }}
            />
            <span
              className="mono text-[0.6rem] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-paper-500)' }}
            >
              UNDEVELOPED
            </span>
          </div>
        )}

        {/* Camera angle / duration tag */}
        {(shot.cameraAngle || shot.duration) && (
          <span
            className="absolute top-2 left-2 mono text-[0.58rem] tracking-[0.16em] uppercase px-2 py-0.5"
            style={{
              background: 'var(--color-ink-950)',
              color: 'var(--color-amber-leader)',
            }}
          >
            {shot.cameraAngle || 'TAKE'}
            {shot.duration ? ` · ${shot.duration}s` : ''}
          </span>
        )}

        {/* Recording strip during processing */}
        {status === 'processing' && (
          <div
            className="absolute inset-x-0 bottom-0 h-1 overflow-hidden"
            style={{ background: 'rgba(8,8,10,0.5)' }}
          >
            <div
              className="h-full w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--color-crimson-mark), transparent)',
                animation: 'shotcard-scan 1.6s linear infinite',
              }}
            />
          </div>
        )}

        {/* Embedded video preview when ready */}
        {hasVideo && (
          <video
            src={keyframe!.videoUrl}
            poster={keyframe?.startFrame}
            controls
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3 flex-1">
        <p
          className="text-[0.86rem] leading-snug line-clamp-3"
          style={{ color: 'var(--color-paper-200)' }}
        >
          {shot.description || '(尚无镜头描述)'}
        </p>
      </div>

      {/* Action bar */}
      <div
        className="flex items-stretch border-t"
        style={{ borderColor: 'var(--color-ink-700)' }}
      >
        <button
          onClick={handleKey}
          disabled={busyKey || isLocked}
          className="flex-1 px-3 py-2.5 mono text-[0.66rem] tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: hasFrame ? 'var(--color-paper-300)' : 'var(--color-amber-leader)',
            borderRight: '1px solid var(--color-ink-700)',
          }}
        >
          {busyKey ? (
            <LoadingSpinner size="sm" />
          ) : hasFrame ? (
            <>
              <RefreshCw size={11} strokeWidth={1.7} />
              重绘首帧
            </>
          ) : (
            <>
              <Wand2 size={11} strokeWidth={1.7} />
              生成首帧
            </>
          )}
        </button>

        <button
          onClick={handleVideo}
          disabled={!hasFrame || busyVid || isLocked}
          className="flex-1 px-3 py-2.5 mono text-[0.66rem] tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            color: hasVideo ? 'var(--color-paper-300)' : 'var(--color-crimson-mark)',
            background:
              status === 'completed'
                ? 'transparent'
                : hasFrame && !isLocked
                ? 'rgba(200, 57, 44, 0.06)'
                : 'transparent',
          }}
        >
          {busyVid ? (
            <LoadingSpinner size="sm" />
          ) : status === 'processing' || status === 'pending' ? (
            <>
              <Loader />
              {status === 'pending' ? '排队中' : '渲染中'}
            </>
          ) : hasVideo ? (
            <>
              <RefreshCw size={11} strokeWidth={1.7} />
              重新拍摄
            </>
          ) : (
            <>
              <Film size={11} strokeWidth={1.7} />
              ROLL · 生成视频
            </>
          )}
        </button>
      </div>

      {/* Error toast */}
      {err && openErr && (
        <div
          className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-start gap-2 mono text-[0.62rem] tracking-[0.1em]"
          style={{
            background: 'rgba(200, 57, 44, 0.95)',
            color: 'var(--color-paper-50)',
          }}
        >
          <AlertCircle size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <span className="flex-1 leading-snug normal-case">{err}</span>
          <button
            onClick={() => setOpenErr(false)}
            className="opacity-70 hover:opacity-100 uppercase"
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes shotcard-scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </article>
  )
}

function Loader() {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{
        background: 'var(--color-crimson-mark)',
        animation: 'pulse-rec 1.6s ease-in-out infinite',
      }}
    />
  )
}
