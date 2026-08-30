/**
 * NovelUploader — 小说上传与章节管理组件
 *
 * 小说与剧本管理系统前端核心组件
 *   - 拖拽 / 点击上传 .txt 文件
 *   - 自动解析章节并展示列表
 *   - 章节选择与字数统计
 *   - 剧本生成触发
 */
import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, BookOpen, Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { novel, type NovelChapter, type NovelParseResult } from '@/api/client'

interface Props {
  /** 剧本生成后回调（rawContent: AI 返回的 JSON 文本） */
  onScriptGenerated: (content: string) => void
}

export function NovelUploader({ onScriptGenerated }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<NovelParseResult | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  // ---------- Upload ----------
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.txt')) {
      setError('仅支持 .txt 文件')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await novel.upload(file)
      setParsed(result)
      setSelectedChapters(new Set(result.chapters.map((_, i) => i)))
      setExpandedChapters(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const toggleChapter = (idx: number) => {
    setSelectedChapters(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const toggleExpand = (idx: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const selectAll = () => {
    if (!parsed) return
    setSelectedChapters(new Set(parsed.chapters.map((_, i) => i)))
  }

  const selectNone = () => setSelectedChapters(new Set())

  // ---------- Generate ----------
  const handleGenerate = useCallback(async () => {
    if (!parsed || selectedChapters.size === 0) return
    setGenerating(true)
    setError(null)
    try {
      const indices = Array.from(selectedChapters).sort()
      const result = await novel.generate(parsed.filePath, indices, {
        language: '中文',
        style: '电影写实',
      })
      if (result.rawContent) {
        onScriptGenerated(result.rawContent)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '剧本生成失败')
    } finally {
      setGenerating(false)
    }
  }, [parsed, selectedChapters, onScriptGenerated])

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      {/* Upload area */}
      {!parsed && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-colors"
          style={{
            borderColor: dragOver ? 'var(--color-amber-leader)' : 'var(--color-ink-500)',
            background: dragOver ? 'rgba(var(--color-amber-leader-rgb, 200,150,50), 0.05)' : 'transparent',
          }}
        >
          <input ref={fileRef} type="file" accept=".txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-amber-leader)' }} />
              <span className="text-sm" style={{ color: 'var(--color-paper-400)' }}>解析中…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload size={40} strokeWidth={1} style={{ color: 'var(--color-paper-500)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-paper-300)' }}>
                  拖拽小说文件到此处或点击上传
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-paper-500)' }}>
                  支持 .txt 文件，最大 10MB · 自动识别章节结构
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 text-sm rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Parsed result */}
      {parsed && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={18} style={{ color: 'var(--color-amber-leader)' }} />
            <span className="font-medium text-lg">{parsed.title || '未命名小说'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--color-paper-400)', background: 'rgba(128,128,128,0.1)' }}>
              {parsed.chapters.length} 章 · {parsed.totalWords.toLocaleString()} 字
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button onClick={selectAll} className="text-xs underline" style={{ color: 'var(--color-paper-400)' }}>全选</button>
            <button onClick={selectNone} className="text-xs underline" style={{ color: 'var(--color-paper-400)' }}>取消全选</button>
            <span className="text-xs" style={{ color: 'var(--color-paper-500)' }}>
              已选 {selectedChapters.size} / {parsed.chapters.length} 章
            </span>
          </div>

          <div className="max-h-[400px] overflow-auto space-y-1">
            {parsed.chapters.map((ch, i) => (
              <ChapterRow
                key={i}
                chapter={ch}
                index={i}
                selected={selectedChapters.has(i)}
                expanded={expandedChapters.has(i)}
                onToggle={() => toggleChapter(i)}
                onExpand={() => toggleExpand(i)}
              />
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || selectedChapters.size === 0}
            className="btn-amber w-full flex items-center justify-center gap-2 py-3 mt-4"
          >
            {generating ? (
              <><Loader2 size={14} className="animate-spin" /> AI 正在生成剧本…</>
            ) : (
              <><Plus size={14} /> 生成剧本（{selectedChapters.size} 章）</>
            )}
          </button>

          <button onClick={() => setParsed(null)}
            className="w-full text-xs underline mt-2" style={{ color: 'var(--color-paper-500)' }}>
            上传其他文件
          </button>
        </div>
      )}
    </div>
  )
}

// ---- ChapterRow ----
function ChapterRow({ chapter, index, selected, expanded, onToggle, onExpand }: {
  chapter: NovelChapter; index: number; selected: boolean; expanded: boolean;
  onToggle: () => void; onExpand: () => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
        style={{
          background: selected ? 'rgba(var(--color-amber-leader-rgb, 200,150,50), 0.08)' : 'rgba(128,128,128,0.03)',
          border: selected ? '1px solid rgba(var(--color-amber-leader-rgb, 200,150,50), 0.2)' : '1px solid transparent',
        }}
        onClick={onToggle}
      >
        <input type="checkbox" checked={selected} onChange={onToggle}
          className="w-4 h-4 accent-amber-500" />
        <FileText size={14} style={{ color: 'var(--color-paper-500)' }} />
        <span className="flex-1 text-sm" style={{ color: 'var(--color-paper-200)' }}>
          第{chapter.chapterNumber}章 · {chapter.title}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-paper-500)' }}>
          {chapter.wordCount.toLocaleString()}字
        </span>
        <button onClick={e => { e.stopPropagation(); onExpand() }}
          className="p-1 rounded hover:bg-ink-600">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="px-6 py-3 mx-4 text-xs leading-relaxed rounded-b-lg whitespace-pre-wrap"
          style={{ color: 'var(--color-paper-400)', background: 'rgba(128,128,128,0.03)' }}>
          {chapter.content.slice(0, 500)}
          {chapter.content.length > 500 && <span className="opacity-50">…</span>}
        </div>
      )}
    </div>
  )
}
