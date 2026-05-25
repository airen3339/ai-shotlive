/**
 * CineGen Director - 全局类型定义
 * 控制论"结构-功能相关律"：数据结构决定系统功能
 */

// ===== 工作流阶段 =====
export type Phase = 'script' | 'assets' | 'director' | 'export'

// ===== 项目核心模型 =====
export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  currentPhase: Phase
  script: ScriptData
  assets: AssetData
  director: DirectorData
  export: ExportData
}

// ===== Phase 01: 剧本数据 =====
export interface ScriptData {
  story: string
  scenes: Scene[]
  characters: Character[]
}

export interface Scene {
  id: string
  title: string
  description: string
  shots: Shot[]
}

export interface Character {
  id: string
  name: string
  description: string
  appearance: string
  referenceImage?: string
}

export interface Shot {
  id: string
  sceneId: string
  description: string
  cameraAngle?: string
  duration?: number
}

// ===== Phase 02: 资产数据 =====
export interface AssetData {
  characterImages: Record<string, string>  // characterId -> blob URL or base64
  sceneImages: Record<string, string>      // sceneId -> blob URL or base64
}

// ===== Phase 03: 导演数据 =====
export interface DirectorData {
  keyframes: Record<string, KeyframeData>  // shotId -> keyframe
}

export interface KeyframeData {
  startFrame?: string
  endFrame?: string
  videoUrl?: string
  videoTaskId?: string
  videoStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

// ===== Phase 04: 导出数据 =====
export interface ExportData {
  videos: VideoSegment[]
}

export interface VideoSegment {
  shotId: string
  url: string
  duration?: number
}

// ===== 工具类型 =====
export function createEmptyProject(name: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentPhase: 'script',
    script: { story: '', scenes: [], characters: [] },
    assets: { characterImages: {}, sceneImages: {} },
    director: { keyframes: {} },
    export: { videos: [] },
  }
}
