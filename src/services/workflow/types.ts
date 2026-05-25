/**
 * 工作流引擎类型定义
 * 控制论"反馈律"：阶段推进基于明确的客观条件，而非用户主观操作
 */
import type { Phase, Project } from '@/types'

export interface PhaseStatus {
  isComplete: boolean
  completionPercentage: number
  missingRequirements: string[]
}

export interface WorkflowEngine {
  canAdvanceTo(project: Project, targetPhase: Phase): boolean
  getPhaseStatus(project: Project, phase: Phase): PhaseStatus
  getNextPhase(current: Phase): Phase | null
  getPrevPhase(current: Phase): Phase | null
}

export type { Phase }
