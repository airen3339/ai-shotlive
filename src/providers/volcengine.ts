import type { AIProvider } from './types'
export function VolcengineProvider(): AIProvider { return { id: 'volcengine', name: '火山引擎', services: {} } }
export function createVolcengineConfig(): Record<string, string> { return {} }
