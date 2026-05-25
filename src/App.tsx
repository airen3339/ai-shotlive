/**
 * App — 应用根组件
 *   控制论"开放系统"：根据 project / currentPhase 决定渲染分支。
 */
import { useEffect } from 'react'
import { ProjectProvider, useProject } from '@/shared/contexts/ProjectContext'
import { Layout } from '@/shared/components/Layout'
import { ProjectSelector } from '@/shared/components/ProjectSelector'
import { loadApiKeyFromStorage } from '@/shared/components/ApiKeyModal'
import { ScriptPhase } from '@/phases/script/ScriptPhase'
import { AssetPhase } from '@/phases/assets/AssetPhase'
import { DirectorPhase } from '@/phases/director/DirectorPhase'
import { ExportPhase } from '@/phases/export/ExportPhase'

function AppContent() {
  const { project, currentPhase } = useProject()

  if (!project) return <ProjectSelector />

  return (
    <Layout>
      {currentPhase === 'script'   && <ScriptPhase />}
      {currentPhase === 'assets'   && <AssetPhase />}
      {currentPhase === 'director' && <DirectorPhase />}
      {currentPhase === 'export'   && <ExportPhase />}
    </Layout>
  )
}

export default function App() {
  // 应用启动时一次性恢复持久化的 API Key
  useEffect(() => {
    loadApiKeyFromStorage().catch(err =>
      console.error('[App] failed to load api key', err),
    )
  }, [])

  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  )
}
