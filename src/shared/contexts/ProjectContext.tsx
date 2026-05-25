/**
 * 项目全局状态 Context
 * 控制论"信息-反馈律"：
 *   单一可信数据源（Project）+ 自动持久化（IndexedDB, debounce 2s）
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Phase, Project } from '@/types'
import { createEmptyProject } from '@/types'
import { storage } from '@/services/storage'
import type { ProjectSummary } from '@/services/storage'

interface ProjectContextValue {
  project: Project | null
  projectList: ProjectSummary[]
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

export function useProject(): ProjectContextValue {
  return useContext(ProjectContext)
}

const SAVE_DEBOUNCE_MS = 2000

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)
  const [projectList, setProjectList] = useState<ProjectSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectRef = useRef<Project | null>(null)

  // Keep latest project in a ref for the timer callback
  useEffect(() => {
    projectRef.current = project
  }, [project])

  const refreshList = useCallback(async () => {
    const list = await storage.listProjects()
    setProjectList(list.sort((a, b) => b.updatedAt - a.updatedAt))
  }, [])

  // Initial list load
  useEffect(() => {
    refreshList().catch(err => console.error('[Project] list load failed', err))
  }, [refreshList])

  const flushSave = useCallback(async () => {
    const current = projectRef.current
    if (!current) return
    setIsSaving(true)
    try {
      await storage.saveProject(current)
      await refreshList()
    } catch (err) {
      console.error('[Project] save failed', err)
    } finally {
      setIsSaving(false)
    }
  }, [refreshList])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      flushSave()
    }, SAVE_DEBOUNCE_MS)
  }, [flushSave])

  // Flush on unmount / page hide
  useEffect(() => {
    const handler = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      void flushSave()
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      handler()
    }
  }, [flushSave])

  const createProject = useCallback(
    async (name: string) => {
      setIsLoading(true)
      try {
        const next = createEmptyProject(name.trim() || '未命名项目')
        await storage.saveProject(next)
        setProject(next)
        await refreshList()
      } finally {
        setIsLoading(false)
      }
    },
    [refreshList],
  )

  const loadProject = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      const loaded = await storage.loadProject(id)
      if (loaded) setProject(loaded)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteProject = useCallback(
    async (id: string) => {
      await storage.deleteProject(id)
      if (projectRef.current?.id === id) setProject(null)
      await refreshList()
    },
    [refreshList],
  )

  const closeProject = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void flushSave().then(() => setProject(null))
  }, [flushSave])

  const updateProject = useCallback(
    (updater: (draft: Project) => Project) => {
      setProject(prev => {
        if (!prev) return prev
        const next = updater(prev)
        const stamped: Project = { ...next, updatedAt: Date.now() }
        return stamped
      })
      scheduleSave()
    },
    [scheduleSave],
  )

  const setPhase = useCallback(
    (phase: Phase) => {
      updateProject(p => ({ ...p, currentPhase: phase }))
    },
    [updateProject],
  )

  const value: ProjectContextValue = {
    project,
    projectList,
    createProject,
    loadProject,
    deleteProject,
    closeProject,
    updateProject,
    currentPhase: project?.currentPhase ?? 'script',
    setPhase,
    isSaving,
    isLoading,
    refreshList,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
