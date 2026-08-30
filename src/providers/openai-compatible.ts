import type { AIProvider } from './types'
export function OpenAICompatibleProvider(): AIProvider { return { id: 'custom', name: '自定义', services: {} } }
