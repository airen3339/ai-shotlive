/**
 * 双存储层：API 优先 + IndexedDB 本地缓存
 *
 * 控制论"自适应控制"：
 *   - 读：先查缓存 → 同时请求 API → API 返回后更新缓存
 *   - 写：写入 API → API 成功后更新缓存
 *   - 离线：API 失败时降级使用缓存数据
 */
import type { Project } from '@/types'
import type { ProjectSummary, StorageService } from '@/services/storage/types'
import { storage as idb } from '@/services/storage/indexeddb'
import { projects } from '@/api/client'

let cacheInitialized = false

/**
 * 将后端返回的项目数据转换为前端 Project 格式
 */
function normalizeToProject(data: Record<string, unknown>): Project {
  return {
    id: (data.id as string) || '',
    name: (data.title as string) || '未命名项目',
    createdAt: Number(data.created_at_ms ?? data.createdAt ?? Date.now()),
    updatedAt: Number(data.last_modified_ms ?? data.updatedAt ?? Date.now()),
    currentPhase: (((data.stage ?? data.currentPhase) as string) || 'script') as Project['currentPhase'],
    script: (data.raw_script ? {
      story: data.raw_script as string,
      scenes: [],
      characters: [],
    } : { story: '', scenes: [], characters: [] }) as Project['script'],
    assets: (data.assets ?? {}) as Project['assets'],
    director: (data.director ?? {}) as Project['director'],
    export: (data.export_data ?? {}) as Project['export'],
  }
}

/**
 * 将前端 Project 转换为后端保存格式
 */
function projectToSaveData(project: Project): Record<string, unknown> {
  return {
    id: project.id,
    title: project.name,
    stage: project.currentPhase,
    raw_script: project.script.story,
    created_at_ms: project.createdAt,
    last_modified_ms: project.updatedAt,
    // 保持完整 JSON 以便后续规范化迁移
    data: JSON.stringify(project),
  }
}

const dualStore: StorageService = {
  // ===== 项目操作 =====

  async saveProject(project: Project): Promise<void> {
    const saveData = projectToSaveData(project)

    try {
      // 写入 API（优先）
      await projects.save(project.id, saveData)
    } catch (err) {
      console.warn('[DualStore] API save failed, using cache only', err)
      // API 失败 → 仅写入本地缓存
    }

    // 同时更新本地缓存
    await idb.saveProject(project)
  },

  async loadProject(id: string): Promise<Project | null> {
    // 先返回缓存（快速响应）
    const cached = await idb.loadProject(id)

    try {
      // 后台刷新缓存
      const data = await projects.get(id)
      const project = normalizeToProject(data)
      // 异步更新缓存（不阻塞返回）
      idb.saveProject(project).catch(() => {})
      return project
    } catch (err) {
      console.warn('[DualStore] API load failed, using cache', err)
      // API 失败 → 返回缓存
      return cached
    }
  },

  async listProjects(): Promise<ProjectSummary[]> {
    try {
      const list = await projects.list()
      // 同时更新本地缓存摘要
      return list.map((p: any) => ({
        id: p.id,
        name: p.title || '未命名项目',
        createdAt: Number(p.createdAt ?? Date.now()),
        updatedAt: Number(p.updatedAt ?? Date.now()),
        currentPhase: p.stage || 'script',
      }))
    } catch (err) {
      console.warn('[DualStore] API list failed, using cache', err)
      // API 失败 → 从缓存读取
      return idb.listProjects()
    }
  },

  async deleteProject(id: string): Promise<void> {
    try {
      await projects.remove(id)
    } catch (err) {
      console.warn('[DualStore] API delete failed', err)
    }
    await idb.deleteProject(id)
  },

  // ===== 资产操作（纯本地） =====

  async saveAsset(key: string, data: Blob): Promise<void> {
    await idb.saveAsset(key, data)
  },

  async loadAsset(key: string): Promise<Blob | null> {
    return idb.loadAsset(key)
  },

  async deleteAsset(key: string): Promise<void> {
    await idb.deleteAsset(key)
  },

  // ===== 配置操作（纯本地：API Key 等敏感信息不上服务器） =====

  async saveConfig(key: string, value: unknown): Promise<void> {
    await idb.saveConfig(key, value)
  },

  async loadConfig<T>(key: string): Promise<T | null> {
    return idb.loadConfig<T>(key)
  },
}

export { dualStore as storage }
