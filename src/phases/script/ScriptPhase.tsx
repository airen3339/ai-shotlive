/**
 * Phase 01 · 剧本分析 ScriptPhase
 *   控制论"信息-反馈律"的第一个完整反馈环路：
 *     用户输入故事 → AI 拆解 → 展示结果 → 用户可编辑修正
 */
import { useMemo, useRef, useState } from 'react'
import {
  MapPin, Users, Film, Plus, Sparkles, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { useProject } from '@/shared/contexts/ProjectContext'
import { useTextAI } from '@/shared/hooks/useAI'
import { PhaseHeader } from '@/shared/components/PhaseHeader'
import type { Character, Scene, Shot } from '@/types'
import { StoryInput } from './components/StoryInput'
import { NovelUploader } from './components/NovelUploader'
import { SceneCard } from './components/SceneCard'
import { CharacterCard } from './components/CharacterCard'

// ============================================================
// AI System Prompt — 分镜师角色
// ============================================================
const SYSTEM_PROMPT = `你是一位专业的影视分镜师。请分析以下故事内容，将其拆解为结构化的分镜数据。

请严格按照以下JSON格式输出（不要添加任何其他文字或markdown标记）：
{
  "scenes": [
    {
      "id": "scene_1",
      "title": "场景标题",
      "description": "场景描述（环境、氛围）",
      "shots": [
        {
          "id": "shot_1_1",
          "description": "镜头描述（动作、表情、画面内容）",
          "cameraAngle": "镜头角度（如：中景、特写、全景、鸟瞰等）",
          "duration": 3
        }
      ]
    }
  ],
  "characters": [
    {
      "id": "char_1",
      "name": "角色名",
      "description": "角色性格和背景",
      "appearance": "角色外貌特征（用于生成图像）"
    }
  ]
}

要求：
1. 每个场景包含2-5个镜头
2. 提取所有主要角色（至少1个）
3. 镜头描述要具体，便于后续生成图像
4. 角色的appearance描述要详细，包含发型、服装、体型等`

// ============================================================
// AI Response Parsing — 从模型输出中提取 JSON
// ============================================================
interface AIResponse {
  scenes?: Array<{
    id?: string
    title?: string
    description?: string
    shots?: Array<{
      id?: string
      description?: string
      cameraAngle?: string
      duration?: number
    }>
  }>
  characters?: Array<{
    id?: string
    name?: string
    description?: string
    appearance?: string
  }>
}

function extractJSON(raw: string): AIResponse {
  // 1) 去除 markdown 代码围栏
  let text = raw.trim()
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) text = fenceMatch[1].trim()

  // 2) 截取第一个 { 到最后一个 }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('AI 返回内容中未找到合法的 JSON 结构')
  }
  const json = text.slice(start, end + 1)

  try {
    return JSON.parse(json) as AIResponse
  } catch (e) {
    throw new Error(
      `JSON 解析失败：${e instanceof Error ? e.message : '未知错误'}`,
    )
  }
}

function normalizeAIResponse(
  resp: AIResponse,
): { scenes: Scene[]; characters: Character[] } {
  const sceneIdMap = new Map<string, string>()
  const scenes: Scene[] = (resp.scenes ?? []).map((s, sIdx) => {
    const sceneId = s.id?.trim() || `scene_${sIdx + 1}_${Date.now().toString(36)}`
    sceneIdMap.set(s.id ?? `__idx_${sIdx}`, sceneId)
    const shots: Shot[] = (s.shots ?? []).map((sh, shIdx) => ({
      id: sh.id?.trim() || `shot_${sIdx + 1}_${shIdx + 1}_${Date.now().toString(36)}`,
      sceneId,
      description: (sh.description ?? '').trim(),
      cameraAngle: sh.cameraAngle?.trim() || undefined,
      duration:
        typeof sh.duration === 'number' && sh.duration > 0
          ? Math.min(60, Math.round(sh.duration))
          : 3,
    }))
    return {
      id: sceneId,
      title: (s.title ?? '').trim() || `场景 ${sIdx + 1}`,
      description: (s.description ?? '').trim(),
      shots,
    }
  })

  const characters: Character[] = (resp.characters ?? []).map((c, cIdx) => ({
    id: c.id?.trim() || `char_${cIdx + 1}_${Date.now().toString(36)}`,
    name: (c.name ?? '').trim() || `角色 ${cIdx + 1}`,
    description: (c.description ?? '').trim(),
    appearance: (c.appearance ?? '').trim(),
  }))

  if (scenes.length === 0) throw new Error('AI 未返回任何场景')
  if (characters.length === 0) throw new Error('AI 未返回任何角色')

  return { scenes, characters }
}

// ============================================================
// 主组件
// ============================================================
export function ScriptPhase() {
  const { project, updateProject, setPhase } = useProject()
  const { generate, loading, error } = useTextAI()
  const resultsRef = useRef<HTMLDivElement>(null)
  const [showNovelUploader, setShowNovelUploader] = useState(false)

  if (!project) return null
  const script = project.script

  const totalShots = useMemo(
    () => script.scenes.reduce((acc, s) => acc + s.shots.length, 0),
    [script.scenes],
  )
  const totalDuration = useMemo(
    () =>
      script.scenes.reduce(
        (acc, s) => acc + s.shots.reduce((a, sh) => a + (sh.duration ?? 0), 0),
        0,
      ),
    [script.scenes],
  )

  const hasScenes = script.scenes.length > 0
  const hasCharacters = script.characters.length > 0
  const isComplete = hasScenes && hasCharacters

  // ---------- Story ----------
  const handleStoryChange = (v: string) => {
    updateProject(p => ({ ...p, script: { ...p.script, story: v } }))
  }

  // ---------- AI Generate ----------
  const handleGenerate = async () => {
    if (loading || !script.story.trim()) return
    try {
      const content = await generate(script.story, {
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.7,
      })
      const parsed = extractJSON(content)
      const { scenes, characters } = normalizeAIResponse(parsed)
      updateProject(p => ({
        ...p,
        script: { ...p.script, scenes, characters },
      }))
      // 滚动到结果区
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (e) {
      // useTextAI 已设置 error；其余解析错误也通过 console 提示
      console.error('[ScriptPhase] generate failed', e)
      // 解析阶段抛错时手动展示
      if (!error) {
        const msg = e instanceof Error ? e.message : '生成失败'
        // 借用 state 不便，将解析错误塞进 ai hook 之外的 alert（最低侵入）
        // 这里我们简单 alert，避免引入新的 toast 依赖
        alert(`AI 拆解失败：${msg}\n\n请检查 API Key 或重试。`)
      }
    }
  }

  // ---------- Scene CRUD ----------
  const updateScene = (sceneId: string, patch: Partial<Scene>) => {
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: p.script.scenes.map(s => (s.id === sceneId ? { ...s, ...patch } : s)),
      },
    }))
  }

  const deleteScene = (sceneId: string) => {
    if (!confirm('删除此场景？相关镜头也将一并移除。')) return
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: p.script.scenes.filter(s => s.id !== sceneId),
      },
    }))
  }

  const addScene = () => {
    const newId = `scene_${Date.now().toString(36)}`
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: [
          ...p.script.scenes,
          {
            id: newId,
            title: `场景 ${p.script.scenes.length + 1}`,
            description: '',
            shots: [],
          },
        ],
      },
    }))
  }

  // ---------- Shot CRUD ----------
  const addShot = (sceneId: string) => {
    const newId = `shot_${sceneId}_${Date.now().toString(36)}`
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: p.script.scenes.map(s =>
          s.id === sceneId
            ? {
                ...s,
                shots: [
                  ...s.shots,
                  {
                    id: newId,
                    sceneId,
                    description: '',
                    cameraAngle: undefined,
                    duration: 3,
                  },
                ],
              }
            : s,
        ),
      },
    }))
  }

  const updateShot = (sceneId: string, shotId: string, patch: Partial<Shot>) => {
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: p.script.scenes.map(s =>
          s.id === sceneId
            ? {
                ...s,
                shots: s.shots.map(sh => (sh.id === shotId ? { ...sh, ...patch } : sh)),
              }
            : s,
        ),
      },
    }))
  }

  const deleteShot = (sceneId: string, shotId: string) => {
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        scenes: p.script.scenes.map(s =>
          s.id === sceneId ? { ...s, shots: s.shots.filter(sh => sh.id !== shotId) } : s,
        ),
      },
    }))
  }

  // ---------- Character CRUD ----------
  const updateCharacter = (id: string, patch: Partial<Character>) => {
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        characters: p.script.characters.map(c => (c.id === id ? { ...c, ...patch } : c)),
      },
    }))
  }

  const deleteCharacter = (id: string) => {
    if (!confirm('删除此角色？')) return
    updateProject(p => ({
      ...p,
      script: { ...p.script, characters: p.script.characters.filter(c => c.id !== id) },
    }))
  }

  const addCharacter = () => {
    const newId = `char_${Date.now().toString(36)}`
    updateProject(p => ({
      ...p,
      script: {
        ...p.script,
        characters: [
          ...p.script.characters,
          { id: newId, name: `角色 ${p.script.characters.length + 1}`, description: '', appearance: '' },
        ],
      },
    }))
  }

  // ---------- Novel Upload → Script ----------
  const handleNovelScriptGenerated = async (rawContent: string) => {
    try {
      const parsed = extractJSON(rawContent)
      const { scenes, characters } = normalizeAIResponse(parsed)
      updateProject(p => ({
        ...p,
        script: { ...p.script, scenes, characters },
      }))
      setShowNovelUploader(false)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (e) {
      alert(`剧本解析失败：${e instanceof Error ? e.message : '格式异常'}`)
    }
  }

  // ============================================================
  return (
    <div className="px-10 lg:px-16 py-12 max-w-[1280px] mx-auto">
      <PhaseHeader phase="script" />

      <div className="rule mt-12 mb-10" />

      {/* ============ Top: Input + Overview ============ */}
      <section className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-7">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowNovelUploader(false)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                !showNovelUploader
                  ? 'text-amber-500 border border-amber-500/30 bg-amber-500/5'
                  : 'text-paper-500 hover:text-paper-300'
              }`}
            >
              手动输入
            </button>
            <button
              onClick={() => setShowNovelUploader(true)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                showNovelUploader
                  ? 'text-amber-500 border border-amber-500/30 bg-amber-500/5'
                  : 'text-paper-500 hover:text-paper-300'
              }`}
            >
              上传小说
            </button>
          </div>

          {showNovelUploader ? (
            <NovelUploader onScriptGenerated={handleNovelScriptGenerated} />
          ) : (
            <StoryInput
              value={script.story}
              onChange={handleStoryChange}
              onGenerate={handleGenerate}
              loading={loading}
              error={error}
              hasGenerated={hasScenes || hasCharacters}
            />
          )}
        </div>

        {/* Right: stats + completion */}
        <aside className="col-span-12 lg:col-span-5 reveal-fade"
               style={{ animationDelay: '180ms' }}>
          <div className="label mb-3">本卷 · OVERVIEW</div>
          <div className="surface-raised p-7 grid grid-cols-3 gap-6">
            <Stat icon={MapPin} label="场景" value={script.scenes.length} />
            <Stat icon={Users} label="角色" value={script.characters.length} />
            <Stat icon={Film} label="镜头" value={totalShots} />
          </div>

          {/* Completion gate */}
          <div className="surface mt-4 p-5">
            <div className="flex items-start gap-3 mb-3">
              {isComplete ? (
                <CheckCircle2 size={14} strokeWidth={1.5} className="mt-0.5 shrink-0"
                              style={{ color: 'var(--color-amber-leader)' }} />
              ) : (
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0"
                             style={{ color: 'var(--color-paper-400)' }} />
              )}
              <div className="flex-1">
                <div className="mono text-[0.65rem] tracking-[0.2em] uppercase mb-1"
                     style={{ color: 'var(--color-paper-400)' }}>
                  Phase 完成条件
                </div>
                <div className="text-[0.8rem] leading-relaxed"
                     style={{ color: 'var(--color-paper-200)' }}>
                  至少 1 个场景 + 至少 1 个角色
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Requirement label="≥1 场景" done={hasScenes} />
              <Requirement label="≥1 角色" done={hasCharacters} />
            </div>

            {isComplete && (
              <button
                onClick={() => setPhase('assets')}
                className="btn-amber w-full flex items-center justify-center gap-2"
              >
                <Sparkles size={12} strokeWidth={1.8} />
                进入 Phase 02 · 资产生成
              </button>
            )}
            {!isComplete && (
              <p className="mono text-[0.65rem] tracking-[0.16em] uppercase italic text-center"
                 style={{ color: 'var(--color-paper-500)' }}>
                完成上述条件后解锁
              </p>
            )}
          </div>

          {totalDuration > 0 && (
            <div className="mt-4 px-5 py-3 flex items-baseline justify-between"
                 style={{ borderTop: '1px solid var(--color-ink-700)' }}>
              <span className="mono text-[0.65rem] tracking-[0.2em] uppercase"
                    style={{ color: 'var(--color-paper-500)' }}>
                估计成片时长
              </span>
              <span className="display text-2xl"
                    style={{ color: 'var(--color-amber-leader)' }}>
                {totalDuration}<span className="text-sm mono ml-1">s</span>
              </span>
            </div>
          )}
        </aside>
      </section>

      <div className="rule mt-14 mb-10" />

      {/* ============ Results ============ */}
      <div ref={resultsRef}>
        {/* Scenes section */}
        <section className="mb-14">
          <SectionHeader
            number="A"
            title="场景"
            subtitle="SCENES"
            count={script.scenes.length}
            onAdd={addScene}
            addLabel="添加场景"
          />

          {script.scenes.length === 0 ? (
            <EmptyHint text="尚无场景。在上方输入故事后点击「AI 智能分镜」。" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {script.scenes.map((scene, i) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={i}
                  onUpdate={patch => updateScene(scene.id, patch)}
                  onDelete={() => deleteScene(scene.id)}
                  onAddShot={() => addShot(scene.id)}
                  onUpdateShot={(shotId, patch) => updateShot(scene.id, shotId, patch)}
                  onDeleteShot={shotId => deleteShot(scene.id, shotId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Characters section */}
        <section>
          <SectionHeader
            number="B"
            title="角色"
            subtitle="CAST"
            count={script.characters.length}
            onAdd={addCharacter}
            addLabel="添加角色"
          />

          {script.characters.length === 0 ? (
            <EmptyHint text="尚无角色。AI 拆解后将自动填充主要角色。" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {script.characters.map((c, i) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  index={i}
                  onUpdate={patch => updateCharacter(c.id, patch)}
                  onDelete={() => deleteCharacter(c.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================
function Stat({
  icon: Icon, label, value,
}: { icon: typeof MapPin; label: string; value: number }) {
  return (
    <div>
      <Icon size={14} strokeWidth={1.4} style={{ color: 'var(--color-amber-leader)' }} />
      <div className="display text-3xl mt-2 leading-none"
           style={{ color: 'var(--color-paper-50)' }}>
        {value}
      </div>
      <div className="mono text-[0.62rem] tracking-[0.18em] uppercase mt-1"
           style={{ color: 'var(--color-paper-500)' }}>
        {label}
      </div>
    </div>
  )
}

function Requirement({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5"
         style={{
           background: done ? 'rgba(212, 165, 116, 0.08)' : 'transparent',
           border: `1px solid ${done ? 'var(--color-amber-deep)' : 'var(--color-ink-600)'}`,
         }}>
      <span className={done ? 'tick tick-active' : 'tick tick-locked'} />
      <span className="mono text-[0.65rem] tracking-[0.14em] uppercase"
            style={{ color: done ? 'var(--color-amber-leader)' : 'var(--color-paper-500)' }}>
        {label}
      </span>
    </div>
  )
}

function SectionHeader({
  number, title, subtitle, count, onAdd, addLabel,
}: {
  number: string
  title: string
  subtitle: string
  count: number
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div className="flex items-end gap-4">
        <span className="phase-numeral text-4xl leading-none"
              style={{ color: 'var(--color-amber-deep)' }}>
          {number}
        </span>
        <div>
          <div className="display text-2xl tracking-tight"
               style={{ color: 'var(--color-paper-50)' }}>
            {title}
          </div>
          <div className="mono text-[0.65rem] tracking-[0.2em] uppercase mt-0.5"
               style={{ color: 'var(--color-paper-500)' }}>
            {subtitle} · {String(count).padStart(2, '0')}
          </div>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="btn-ghost flex items-center gap-1.5"
      >
        <Plus size={12} strokeWidth={2} />
        {addLabel}
      </button>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="surface py-12 text-center">
      <div className="mono text-[0.7rem] tracking-[0.18em] uppercase italic"
           style={{ color: 'var(--color-paper-500)' }}>
        {text}
      </div>
    </div>
  )
}
