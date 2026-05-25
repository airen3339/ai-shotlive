/**
 * IndexedDB存储实现
 *
 * 数据库：cinegen-director
 * 对象存储：
 *   - projects: 项目数据（JSON）
 *   - assets: 二进制资产（Blob）
 *   - config: 应用配置（key-value）
 */
import type { Project } from '@/types'
import type { StorageService, ProjectSummary } from './types'

const DB_NAME = 'cinegen-director'
const DB_VERSION = 1

// 对象存储名称
const STORES = {
  PROJECTS: 'projects',
  ASSETS: 'assets',
  CONFIG: 'config',
} as const

class IndexedDBStorage implements StorageService {
  private db: IDBDatabase | null = null
  private openPromise: Promise<IDBDatabase> | null = null

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.openPromise) return this.openPromise

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        this.openPromise = null
        reject(request.error ?? new Error('Failed to open IndexedDB'))
      }

      request.onblocked = () => {
        this.openPromise = null
        reject(new Error('IndexedDB open blocked'))
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建projects存储（使用keyPath 'id'，便于按项目id索引）
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' })
        }

        // 创建assets存储（外部key，存放Blob）
        if (!db.objectStoreNames.contains(STORES.ASSETS)) {
          db.createObjectStore(STORES.ASSETS)
        }

        // 创建config存储（外部key-value）
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
          db.createObjectStore(STORES.CONFIG)
        }
      }

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 处理版本变化（其他标签页升级时主动关闭，避免锁库）
        db.onversionchange = () => {
          db.close()
          this.db = null
        }

        this.db = db
        resolve(db)
      }
    })

    return this.openPromise
  }

  /**
   * 通用：将IDBRequest包装成Promise
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IDB request failed'))
    })
  }

  /**
   * 通用：等待事务结束（用于写操作的最终确认）
   */
  private promisifyTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'))
    })
  }

  // ===== 项目操作 =====

  async saveProject(project: Project): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.PROJECTS, 'readwrite')
    const store = tx.objectStore(STORES.PROJECTS)
    store.put(project)
    await this.promisifyTransaction(tx)
  }

  async loadProject(id: string): Promise<Project | null> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.PROJECTS, 'readonly')
    const store = tx.objectStore(STORES.PROJECTS)
    const result = await this.promisifyRequest(store.get(id))
    return (result as Project | undefined) ?? null
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.PROJECTS, 'readonly')
    const store = tx.objectStore(STORES.PROJECTS)
    const all = await this.promisifyRequest(store.getAll())

    // 仅返回摘要字段，避免传输完整项目对象
    return (all as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id ?? ''),
      name: String(p.name ?? ''),
      createdAt: Number(p.createdAt ?? 0),
      updatedAt: Number(p.updatedAt ?? 0),
      currentPhase: String(p.currentPhase ?? ''),
    }))
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.PROJECTS, 'readwrite')
    const store = tx.objectStore(STORES.PROJECTS)
    store.delete(id)
    await this.promisifyTransaction(tx)
  }

  // ===== 资产操作 =====

  async saveAsset(key: string, data: Blob): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.ASSETS, 'readwrite')
    const store = tx.objectStore(STORES.ASSETS)
    store.put(data, key)
    await this.promisifyTransaction(tx)
  }

  async loadAsset(key: string): Promise<Blob | null> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.ASSETS, 'readonly')
    const store = tx.objectStore(STORES.ASSETS)
    const result = await this.promisifyRequest(store.get(key))
    return (result as Blob | undefined) ?? null
  }

  async deleteAsset(key: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.ASSETS, 'readwrite')
    const store = tx.objectStore(STORES.ASSETS)
    store.delete(key)
    await this.promisifyTransaction(tx)
  }

  // ===== 配置操作 =====

  async saveConfig(key: string, value: unknown): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.CONFIG, 'readwrite')
    const store = tx.objectStore(STORES.CONFIG)
    store.put(value, key)
    await this.promisifyTransaction(tx)
  }

  async loadConfig<T>(key: string): Promise<T | null> {
    const db = await this.getDB()
    const tx = db.transaction(STORES.CONFIG, 'readonly')
    const store = tx.objectStore(STORES.CONFIG)
    const result = await this.promisifyRequest(store.get(key))
    return (result as T | undefined) ?? null
  }
}

// 单例导出
export const storage: StorageService = new IndexedDBStorage()
