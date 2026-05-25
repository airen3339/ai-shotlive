/**
 * 存储服务接口定义
 * 控制论"信息-反馈律"：数据的可靠持久化是反馈环路的基础
 */
import type { Project } from '@/types'

export interface ProjectSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  currentPhase: string
}

export interface StorageService {
  // 项目操作
  saveProject(project: Project): Promise<void>
  loadProject(id: string): Promise<Project | null>
  listProjects(): Promise<ProjectSummary[]>
  deleteProject(id: string): Promise<void>

  // 资产操作（二进制数据）
  saveAsset(key: string, data: Blob): Promise<void>
  loadAsset(key: string): Promise<Blob | null>
  deleteAsset(key: string): Promise<void>

  // 配置操作
  saveConfig(key: string, value: unknown): Promise<void>
  loadConfig<T>(key: string): Promise<T | null>
}
