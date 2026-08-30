import type { AIProvider } from './types'
export function DashScopeProvider(): AIProvider { return { id: 'dashscope', name: '百炼', services: {} } }
export function createDashScopeConfig(): Record<string, string> { return {} }
