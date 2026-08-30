/**
 * 项目全局状态 Context — 纯 API 驱动
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import type { Phase, Project } from '@/types'
import { createEmptyProject } from '@/types'
import { projects } from '@/api/client'

interface ProjectContextValue {
  project: Project | null
  projectList: Array<{ id: string; name: string; createdAt: number; updatedAt: number; currentPhase: Phase }>
  createProject: (name: string) => Promise<void>
  loadProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  closeProject: () => void
  updateProject: (updater: (draft: Project) => Project) => void
  currentPhase: Phase
  setPhase: (phase: Phase) => void
  isSaving: boolean
  isLoading: boolean
  refreshList: () => Promise<void>
}

export const ProjectContext = createContext<ProjectContextValue>(null!)
export function useProject(): ProjectContextValue { return useContext(ProjectContext) }

function normalize(data: Record<string, unknown>): Project {
  // Server returns the full project JSON when is_normalized=0 (direct data column read)
  if (data.data) {
    try {
      const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      return normalize(parsed as Record<string, unknown>);
    } catch {
      // fall through
    }
  }

  // Direct project format from API (is_normalized=0, has currentPhase)
  if (data.currentPhase || data.script) {
    return {
      id: (data.id as string) || '',
      name: (data.name as string) || (data.title as string) || '未命名项目',
      createdAt: Number(data.createdAt || data.created_at_ms || Date.now()),
      updatedAt: Number(data.updatedAt || data.last_modified_ms || Date.now()),
      currentPhase: (data.currentPhase as Phase) || 'script',
      script: (data.script as Project['script']) || { story: '', scenes: [], characters: [] },
      assets: (data.assets as Project['assets']) || { characterImages: {}, sceneImages: {} },
      director: (data.director as Project['director']) || { keyframes: {} },
      export: (data.export_data || data.export || {}) as Project['export'],
    };
  }

  // Minimal format from loadProjectNormalized fallback (has stage)
  if (data.stage) {
    return {
      ...createEmptyProject((data.title as string) || '未命名项目'),
      id: (data.id as string) || '',
      currentPhase: (data.stage as Phase) || 'script',
      script: { story: (data.rawScript as string) || '', scenes: [], characters: [] },
    };
  }

  // Last resort
  return createEmptyProject((data.title as string) || '未命名项目');
}

function toSave(p: Project): Record<string, unknown> {
  return { id: p.id, title: p.name, stage: p.currentPhase, raw_script: p.script.story, created_at_ms: p.createdAt, last_modified_ms: p.updatedAt, data: JSON.stringify(p), is_normalized: 0 }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)
  const [projectList, setProjectList] = useState<ProjectContextValue['projectList']>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const projectRef = useRef<Project | null>(null)
  useEffect(() => { projectRef.current = project }, [project])

  const refreshList = useCallback(async () => {
    try {
      const list = await projects.list()
      setProjectList(list.map(p => ({ id: p.id, name: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt, currentPhase: p.stage as Phase })))
    } catch { setProjectList([]) }
  }, [])

  useEffect(() => { refreshList().finally(() => setIsLoading(false)) }, [refreshList])

  const createProject = useCallback(async (name: string) => {
    setIsLoading(true)
    try {
      const next = createEmptyProject(name.trim() || '未命名项目')
      await projects.save(next.id, toSave(next))
      setProject(next)
      await refreshList()
    } finally { setIsLoading(false) }
  }, [refreshList])

  const loadProject = useCallback(async (id: string) => {
    setIsLoading(true)
    try { const data = await projects.get(id); setProject(normalize(data)) } finally { setIsLoading(false) }
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    await projects.remove(id)
    if (projectRef.current?.id === id) setProject(null)
    await refreshList()
  }, [refreshList])

  const closeProject = useCallback(() => { setProject(null) }, [])

  const updateProject = useCallback((updater: (draft: Project) => Project) => {
    setProject(prev => {
      if (!prev) return prev
      const next = { ...updater(prev), updatedAt: Date.now() }
      projects.save(next.id, toSave(next)).catch(() => {})
      return next
    })
  }, [])

  const setPhase = useCallback((phase: Phase) => { updateProject(p => ({ ...p, currentPhase: phase })) }, [updateProject])

  return <ProjectContext.Provider value={{ project, projectList, createProject, loadProject, deleteProject, closeProject, updateProject, currentPhase: project?.currentPhase ?? 'script', setPhase, isSaving, isLoading, refreshList }}>{children}</ProjectContext.Provider>
}
