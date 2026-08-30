import type { AiConfig } from '@/api/client'
import type { CustomProviderConfig } from './types'
import { aiConfig } from '@/api/client'

const DEFAULT_CONFIG: AiConfig = {
  dashscope: { apiKey: '', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', textModel: 'qwen-plus', imageModel: 'wanx2.1-t2i-turbo' },
  volcengine: { apiKey: '', endpointId: '', imageModel: 'doubao-seedream-4-5-251128', videoModel: 'doubao-seedance-1-5-pro-251215' },
  custom: [],
  routes: { textProviderId: 'dashscope', imageProviderId: 'volcengine', videoProviderId: 'volcengine' },
}

class ProviderManagerImpl {
  private config: AiConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  private initialized = false

  async init(): Promise<void> {
    try {
      const sc = await aiConfig.get()
      if (sc) this.config = { dashscope: {...DEFAULT_CONFIG.dashscope, ...(sc.dashscope||{})}, volcengine: {...DEFAULT_CONFIG.volcengine, ...(sc.volcengine||{})}, custom: sc.custom||[], routes: sc.routes||DEFAULT_CONFIG.routes }
    } catch {}
    this.initialized = true
  }

  getConfig(): AiConfig { return JSON.parse(JSON.stringify(this.config)) }
  isReady(): boolean { return !!(this.config.dashscope?.apiKey || this.config.volcengine?.apiKey || this.config.custom?.length > 0) }

  getTextService() { return this }
  getImageService() { return this }
  getVideoService() { return this }

  async saveConfig(cfg: AiConfig): Promise<void> { this.config = cfg; await aiConfig.save(cfg) }

  async updateBuiltInConfig(providerId: 'dashscope' | 'volcengine', updates: Record<string, string>): Promise<void> {
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(updates)) { if (v && !v.startsWith('••••')) clean[k] = v }
    if (Object.keys(clean).length === 0) return
    (this.config as any)[providerId] = { ...(this.config as any)[providerId], ...clean }
    await aiConfig.save(this.config)
  }

  async updateBuiltIn(providerId: 'dashscope' | 'volcengine', updates: Record<string, string>): Promise<void> {
    return this.updateBuiltInConfig(providerId, updates)
  }

  async setRoutes(routes: AiConfig['routes']): Promise<void> { this.config.routes = routes; await aiConfig.save(this.config) }

  listProviders(): Array<{ id: string; name: string; capabilities: string[] }> {
    const caps: Array<{ id: string; name: string; capabilities: string[] }> = []
    caps.push({ id: 'dashscope', name: '百炼 (DashScope)', capabilities: this.config.dashscope?.apiKey ? ['text'] : [] })
    caps.push({ id: 'volcengine', name: '火山引擎 (Volcengine)', capabilities: this.config.volcengine?.apiKey ? ['image', 'video'] : [] })
    for (const c of this.config.custom || []) caps.push({ id: c.id, name: c.name, capabilities: c.capabilities })
    return caps
  }

  async addCustomProvider(cfg: CustomProviderConfig): Promise<void> {
    if (this.config.custom?.find(c => c.id === cfg.id)) throw new Error('ID 已存在')
    this.config.custom = [...(this.config.custom || []), cfg as any]
    await aiConfig.save(this.config)
  }

  async removeCustomProvider(id: string): Promise<void> {
    this.config.custom = (this.config.custom || []).filter(c => c.id !== id)
    await aiConfig.save(this.config)
  }

  listCustomProviders(): CustomProviderConfig[] { return (this.config.custom || []) as CustomProviderConfig[] }
  getProvider(id: string) { return this.config.custom?.find(c => c.id === id) }
  getRoutes() { return { ...this.config.routes } }
}

export const providerManager = new ProviderManagerImpl()
