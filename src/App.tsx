/**
 * App — 纯渲染层：认证 → 项目选择 → 阶段渲染
 *   无本地存储，所有数据来自服务端
 */
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthScreen } from '@/components/AuthScreen'
import { ProjectProvider, useProject } from '@/shared/contexts/ProjectContext'
import { Layout } from '@/shared/components/Layout'
import { ProjectSelector } from '@/shared/components/ProjectSelector'
import { ScriptPhase } from '@/phases/script/ScriptPhase'
import { AssetPhase } from '@/phases/assets/AssetPhase'
import { DirectorPhase } from '@/phases/director/DirectorPhase'
import { ExportPhase } from '@/phases/export/ExportPhase'

function AppContent() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-ink-900)', color: 'var(--color-paper-100)' }}>
        <div className="mono text-sm">加载中…</div>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return (
    <ProjectProvider>
      <AppWithProject />
    </ProjectProvider>
  )
}

function AppWithProject() {
  const { project, currentPhase } = useProject()

  return (
    <Layout>
      {!project && <ProjectSelector />}
      {project && currentPhase === 'script'   && <ScriptPhase />}
      {project && currentPhase === 'assets'   && <AssetPhase />}
      {project && currentPhase === 'director' && <DirectorPhase />}
      {project && currentPhase === 'export'   && <ExportPhase />}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
