/**
 * VideoCard — 单个成片片段卡（导出阶段）
 *   缩略图 + 内嵌播放 + 下载（blob URL）
 *
 *  控制论"信息-反馈律"：下载流程与播放流程独立反馈，互不阻塞。
 */
import { useRef, useState } from 'react'
import { Play, Pause, Download, Loader2, Film } from 'lucide-react'

interface Props {
  index: number
  sceneIndex: number
  shotIndexInScene: number
  sceneTitle: string
  shotDescription: string
  cameraAngle?: string
  duration?: number
  posterUrl?: string
  videoUrl: string
  fileName: string
}

export function VideoCard({
  index,
  sceneIndex,
  shotIndexInScene,
  sceneTitle,
  shotDescription,
  cameraAngle,
  duration,
  posterUrl,
  videoUrl,
  fileName,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [activated, setActivated] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadErr, setDownloadErr] = useState<string | null>(null)

  const togglePlay = async () => {
    const v = videoRef.current
    if (!v) {
      setActivated(true)
      return
    }
    if (v.paused) {
      try {
        await v.play()
      } catch {
        /* 播放被阻止时忽略 */
      }
    } else {
      v.pause()
    }
  }

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    setDownloadErr(null)
    try {
      const res = await fetch(videoUrl, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      // 异步释放 blob，给浏览器留出处理时间
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
    } catch (e) {
      // 跨域下载失败时回退为新窗口直接打开
      try {
        const a = document.createElement('a')
        a.href = videoUrl
        a.download = fileName
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      } catch {
        setDownloadErr(e instanceof Error ? e.message : '下载失败')
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <article
      className="surface flex flex-col group transition-colors"
      style={{
        outline: '1px solid var(--color-ink-700)',
      }}
    >
      {/* Frame */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ background: 'var(--color-ink-950)' }}
      >
        {activated ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            controls
            preload="metadata"
            autoPlay
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        ) : (
          <>
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={`镜头 ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, var(--color-ink-900) 0 14px, var(--color-ink-850) 14px 28px)',
                }}
              >
                <Film
                  size={22}
                  strokeWidth={1.1}
                  style={{ color: 'var(--color-paper-500)' }}
                />
              </div>
            )}

            {/* film-grain darken overlay */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,8,10,0.0) 40%, rgba(8,8,10,0.65) 100%)',
              }}
            />

            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center group/play"
              aria-label="播放"
            >
              <span
                className="w-14 h-14 flex items-center justify-center transition-all"
                style={{
                  background: 'rgba(212,165,116,0.92)',
                  color: 'var(--color-ink-950)',
                  boxShadow: '0 12px 32px -12px rgba(212,165,116,0.6)',
                }}
              >
                <Play
                  size={20}
                  strokeWidth={2}
                  fill="currentColor"
                  className="translate-x-[1px] group-hover/play:scale-110 transition-transform"
                />
              </span>
            </button>
          </>
        )}

        {/* Segment tag */}
        <span
          className="absolute top-2 left-2 mono text-[0.6rem] tracking-[0.18em] uppercase px-2 py-0.5 z-10"
          style={{
            background: 'var(--color-ink-950)',
            color: 'var(--color-amber-leader)',
          }}
        >
          SEG · {String(index + 1).padStart(2, '0')}
        </span>

        {/* Scene · Shot tag */}
        <span
          className="absolute top-2 right-2 mono text-[0.58rem] tracking-[0.16em] uppercase px-2 py-0.5 z-10"
          style={{
            background: 'rgba(8,8,10,0.7)',
            color: 'var(--color-paper-300)',
          }}
        >
          SC{String(sceneIndex + 1).padStart(2, '0')} ·
          SH{String(shotIndexInScene + 1).padStart(2, '0')}
          {duration ? ` · ${duration}s` : ''}
        </span>

        {playing && (
          <span
            className="absolute bottom-2 right-2 mono text-[0.58rem] tracking-[0.18em] uppercase px-2 py-0.5 flex items-center gap-1.5 z-10"
            style={{
              background: 'rgba(8,8,10,0.7)',
              color: 'var(--color-crimson-mark)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--color-crimson-mark)',
                animation: 'pulse-rec 1.4s ease-in-out infinite',
              }}
            />
            PLAYING
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="p-4 flex flex-col flex-1">
        <div
          className="mono text-[0.6rem] tracking-[0.18em] uppercase"
          style={{ color: 'var(--color-paper-500)' }}
        >
          {sceneTitle || '未命名场景'}
          {cameraAngle ? <> · {cameraAngle}</> : null}
        </div>
        <p
          className="text-[0.85rem] mt-1.5 line-clamp-2 leading-snug flex-1"
          style={{ color: 'var(--color-paper-100)' }}
        >
          {shotDescription || '(尚无镜头描述)'}
        </p>

        <div className="flex items-center gap-2 mt-3.5">
          <button
            onClick={togglePlay}
            className="flex-1 btn-ghost flex items-center justify-center gap-2"
          >
            {playing ? (
              <>
                <Pause size={11} strokeWidth={1.7} />
                暂停
              </>
            ) : (
              <>
                <Play size={11} strokeWidth={1.7} />
                {activated ? '播放' : '试映'}
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 btn-amber flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 size={12} strokeWidth={1.8} className="animate-spin" />
                打包中
              </>
            ) : (
              <>
                <Download size={12} strokeWidth={1.7} />
                下载片段
              </>
            )}
          </button>
        </div>

        {downloadErr && (
          <div
            className="mt-2 mono text-[0.6rem] tracking-[0.1em] normal-case"
            style={{ color: 'var(--color-crimson-mark)' }}
          >
            {downloadErr}
          </div>
        )}
      </div>
    </article>
  )
}
