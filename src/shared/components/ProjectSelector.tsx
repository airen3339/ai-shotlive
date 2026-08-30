/**
 * ProjectSelector — 进入应用的"片场入口"
 *   左：编辑室简介 / 标题 + 新建项目；右：已有项目档案。
 *   若 Provider 未配置，顶部显眼提示。
 */
import { useEffect, useState } from 'react'
import {
  ArrowRight, Plus, Trash2, FolderOpen,
  Sparkle, Settings,
} from 'lucide-react'
import { useProject } from '@/shared/contexts/ProjectContext'
import { SettingsPanel } from '@/components/SettingsPanel'
import { providerManager } from '@/providers'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

function formatDate(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PHASE_LABEL: Record<string, string> = {
  script:   '剧本分析',
  assets:   '资产生成',
  director: '导演工作台',
  export:   '成片导出',
}

export function ProjectSelector() {
  const { projectList, createProject, loadProject, deleteProject, isLoading, refreshList } = useProject()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiReady, setApiReady] = useState(false)

  useEffect(() => {
    providerManager.init().then(() => {
      setApiReady(providerManager.isReady())
      refreshList()
    }).catch(() => {
      refreshList()
    })
  }, [refreshList])

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      await createProject(name)
      setName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="grain-bg min-h-screen w-full overflow-auto"
         style={{ color: 'var(--color-paper-100)' }}>
      <div className="relative z-[2] mx-auto max-w-[1280px] px-10 py-14">

        {/* ==== Masthead ==== */}
        <header className="grid grid-cols-12 gap-8 mb-16">
          <div className="col-span-12 md:col-span-7 reveal-rise">
            <div className="mono text-[0.7rem] tracking-[0.32em] uppercase mb-6"
                 style={{ color: 'var(--color-amber-leader)' }}>
              <span className="tick tick-rec mr-3 align-middle" />
              CINEGEN · DIRECTOR'S ATELIER · EST. MMXXVI
            </div>
            <h1 className="display leading-[0.92] tracking-[-0.03em]"
                style={{ fontSize: 'clamp(3.6rem, 7vw, 6rem)', color: 'var(--color-paper-50)' }}>
              暗房中
              <span className="italic font-light"
                    style={{ color: 'var(--color-amber-leader)' }}> 显影 </span>
              <br />
              一部由你执导的<br />
              <span className="italic font-light">短片。</span>
            </h1>
            <p className="mt-7 max-w-lg text-[0.95rem] leading-relaxed"
               style={{ color: 'var(--color-paper-400)' }}>
              四个创作章节，从剧本拆解到成片导出，
              依序推进。每一帧都源自你的故事，
              每一次推进都基于客观完成度。
            </p>
          </div>

          {/* Editorial sidebar — small specs */}
          <aside className="col-span-12 md:col-span-5 md:pl-10 md:border-l reveal-fade"
                 style={{ borderColor: 'var(--color-ink-600)', animationDelay: '200ms' }}>
            <div className="space-y-7 pt-2">
              {[
                { n: '01', t: '剧本分析', d: 'Screenplay → Scenes → Shots' },
                { n: '02', t: '资产生成', d: 'Characters · Reference imagery' },
                { n: '03', t: '导演工作台', d: 'Keyframe → Motion → Take' },
                { n: '04', t: '成片导出', d: 'Final cut · MP4 / Sequence' },
              ].map(item => (
                <div key={item.n} className="flex items-baseline gap-5">
                  <div className="phase-numeral text-3xl shrink-0 w-12"
                       style={{ color: 'var(--color-amber-deep)' }}>
                    {item.n}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--color-paper-100)' }}>
                      {item.t}
                    </div>
                    <div className="mono text-[0.68rem] tracking-[0.14em] uppercase mt-1"
                         style={{ color: 'var(--color-paper-500)' }}>
                      {item.d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </header>

        {/* ==== Provider warning if missing ==== */}
        {!apiReady && (
          <div className="surface-raised mb-10 px-6 py-5 flex items-center justify-between gap-6 reveal-rise"
               style={{ borderColor: 'var(--color-crimson-deep)', animationDelay: '300ms' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center"
                   style={{ background: 'rgba(200, 57, 44, 0.12)', border: '1px solid var(--color-crimson-deep)' }}>
                <Settings size={16} strokeWidth={1.5} style={{ color: 'var(--color-crimson-mark)' }} />
              </div>
              <div>
                <div className="mono text-[0.7rem] tracking-[0.2em] uppercase mb-0.5"
                     style={{ color: 'var(--color-crimson-mark)' }}>
                  MODEL CONFIG REQUIRED
                </div>
                <div className="text-sm" style={{ color: 'var(--color-paper-200)' }}>
                  请先配置 AI 模型（百炼/火山引擎/自定义端点）。
                </div>
              </div>
            </div>
            <button onClick={() => setSettingsOpen(true)} className="btn-amber">
              配置模型
            </button>
          </div>
        )}

        {/* ==== Two-column: New + Library ==== */}
        <div className="grid grid-cols-12 gap-10 mb-20">

          {/* New project — feature card */}
          <section className="col-span-12 md:col-span-5 reveal-rise" style={{ animationDelay: '380ms' }}>
            <div className="label mb-4">章节 I · 新建项目</div>
            <div className="surface-raised relative p-8 overflow-hidden">
              <Sparkle
                size={120}
                strokeWidth={0.6}
                className="absolute -top-6 -right-6 opacity-[0.08]"
                style={{ color: 'var(--color-amber-leader)' }}
              />
              <h2 className="display text-3xl leading-tight mb-2"
                  style={{ color: 'var(--color-paper-50)' }}>
                开一卷<span className="italic" style={{ color: 'var(--color-amber-leader)' }}>新片</span>
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-paper-400)' }}>
                给你的项目起一个名字。一切从一行字开始。
              </p>

              <label className="label block mb-2">PROJECT · TITLE</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="例如：午夜列车上的陌生人"
                className="field w-full text-base"
                disabled={creating}
              />

              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="btn-amber mt-6 w-full flex items-center justify-center gap-3"
              >
                {creating ? <LoadingSpinner size="sm" label="开机中" /> : (
                  <>
                    <Plus size={14} strokeWidth={1.8} />
                    开机 · ROLL CAMERA
                    <ArrowRight size={14} strokeWidth={1.8} />
                  </>
                )}
              </button>

              {!apiReady && (
                <div className="mt-3 mono text-[0.65rem] tracking-[0.18em] uppercase text-center"
                     style={{ color: 'var(--color-crimson-mark)' }}>
                  请先完成模型配置
                </div>
              )}
            </div>
          </section>

          {/* Library */}
          <section className="col-span-12 md:col-span-7 reveal-fade" style={{ animationDelay: '500ms' }}>
            <div className="flex items-end justify-between mb-4">
              <div className="label">章节 II · 项目档案</div>
              <div className="mono text-[0.7rem] tracking-[0.18em] uppercase"
                   style={{ color: 'var(--color-paper-500)' }}>
                {projectList.length.toString().padStart(2, '0')} 卷
              </div>
            </div>

            {isLoading ? (
              <div className="surface px-6 py-12 flex justify-center">
                <LoadingSpinner label="读取档案" />
              </div>
            ) : projectList.length === 0 ? (
              <div className="surface px-6 py-16 text-center">
                <FolderOpen size={28} strokeWidth={1} className="mx-auto mb-4"
                            style={{ color: 'var(--color-paper-500)' }} />
                <div className="display italic text-xl mb-1"
                     style={{ color: 'var(--color-paper-200)' }}>
                  档案室空无一物
                </div>
                <div className="text-xs"
                     style={{ color: 'var(--color-paper-500)' }}>
                  从左侧开机一部新片开始。
                </div>
              </div>
            ) : (
              <ul className="surface divide-y" style={{ borderColor: 'var(--color-ink-600)' }}>
                {projectList.map((p, idx) => (
                  <li key={p.id} className="group flex items-stretch transition-colors"
                      style={{ borderColor: 'var(--color-ink-700)' }}>
                    <button
                      onClick={() => loadProject(p.id)}
                      className="flex-1 text-left px-6 py-5 flex items-center gap-5 transition-colors hover:bg-ink-800"
                      style={{ background: 'transparent' }}
                    >
                      <div className="phase-numeral text-2xl shrink-0 w-10"
                           style={{ color: 'var(--color-amber-deep)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[1.05rem] truncate"
                             style={{ color: 'var(--color-paper-100)' }}>
                          {p.name}
                        </div>
                        <div className="mono text-[0.65rem] tracking-[0.16em] uppercase mt-1 flex items-center gap-3"
                             style={{ color: 'var(--color-paper-500)' }}>
                          <span>{formatDate(p.updatedAt)}</span>
                          <span>·</span>
                          <span style={{ color: 'var(--color-amber-deep)' }}>
                            {PHASE_LABEL[p.currentPhase] ?? p.currentPhase}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={16} strokeWidth={1.4}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-amber-leader)' }}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`确认删除"${p.name}"？此操作不可撤销。`)) {
                          deleteProject(p.id)
                        }
                      }}
                      aria-label="删除"
                      className="px-5 transition-colors"
                      style={{
                        borderLeft: '1px solid var(--color-ink-700)',
                        color: 'var(--color-paper-500)',
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.4} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ==== Footer ==== */}
        <footer className="rule pt-6 flex items-center justify-between mono text-[0.65rem] tracking-[0.2em] uppercase"
                style={{ color: 'var(--color-paper-500)' }}>
          <span>CineGen Director · Local-first · IndexedDB</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="hover:text-amber-glow transition-colors flex items-center gap-2"
            style={{ color: apiReady ? 'var(--color-paper-500)' : 'var(--color-crimson-mark)' }}
          >
            <Settings size={11} strokeWidth={1.5} />
            模型配置
          </button>
        </footer>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
