/**
 * Layout — 整体布局框架
 *   左侧 Sidebar + 右侧主舞台。
 *   背景应用胶片噪点 + 微妙暖光晕，营造暗房氛围。
 */
import type { ReactNode } from 'react'
import { Sidebar } from '@/shared/components/Sidebar'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="grain-bg flex h-screen overflow-hidden"
         style={{ color: 'var(--color-paper-100)' }}>
      <Sidebar />
      <main className="relative flex-1 overflow-auto"
            style={{ zIndex: 2 }}>
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
