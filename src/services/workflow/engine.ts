/**
 * 工作流引擎实现
 * 控制论"结构-功能相关律"：
 *   推进规则不可绕过，保证每个阶段的输入都是上一阶段的合规输出。
 */
import type { Phase, Project } from '@/types'
import type { PhaseStatus, WorkflowEngine } from './types'

const PHASE_ORDER: Phase[] = ['script', 'assets', 'director', 'export']

function indexOf(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase)
}

function statusForScript(project: Project): PhaseStatus {
  const missing: string[] = []
  const hasStory = project.script.story.trim().length > 0
  const hasScene = project.script.scenes.length > 0
  const hasCharacter = project.script.characters.length > 0

  if (!hasStory) missing.push('需要输入故事大纲')
  if (!hasScene) missing.push('至少需要 1 个场景')
  if (!hasCharacter) missing.push('至少需要 1 个角色')

  const total = 3
  const filled = [hasStory, hasScene, hasCharacter].filter(Boolean).length

  return {
    isComplete: hasScene && hasCharacter,
    completionPercentage: Math.round((filled / total) * 100),
    missingRequirements: missing,
  }
}

function statusForAssets(project: Project): PhaseStatus {
  const characters = project.script.characters
  const missing: string[] = []
  if (characters.length === 0) {
    missing.push('请先在 Phase 01 创建角色')
  }
  const withRef = characters.filter(c => Boolean(c.referenceImage)).length
  if (withRef === 0) {
    missing.push('至少 1 个角色需要参考图（定妆图）')
  }

  const denominator = Math.max(characters.length, 1)
  const percentage = characters.length === 0 ? 0 : Math.round((withRef / denominator) * 100)

  return {
    isComplete: withRef >= 1,
    completionPercentage: percentage,
    missingRequirements: missing,
  }
}

function statusForDirector(project: Project): PhaseStatus {
  const allShots = project.script.scenes.flatMap(s => s.shots)
  const keyframes = project.director.keyframes
  const shotsWithVideo = allShots.filter(shot => Boolean(keyframes[shot.id]?.videoUrl)).length
  const missing: string[] = []
  if (allShots.length === 0) missing.push('请先在 Phase 01 生成镜头')
  if (shotsWithVideo === 0) missing.push('至少 1 个镜头需要生成视频')

  const denominator = Math.max(allShots.length, 1)
  const percentage = allShots.length === 0 ? 0 : Math.round((shotsWithVideo / denominator) * 100)

  return {
    isComplete: shotsWithVideo >= 1,
    completionPercentage: percentage,
    missingRequirements: missing,
  }
}

function statusForExport(project: Project): PhaseStatus {
  const videos = project.export.videos
  return {
    isComplete: videos.length > 0,
    completionPercentage: videos.length > 0 ? 100 : 0,
    missingRequirements: videos.length > 0 ? [] : ['暂无可导出的成片'],
  }
}

export const workflowEngine: WorkflowEngine = {
  canAdvanceTo(project, targetPhase) {
    const targetIdx = indexOf(targetPhase)
    if (targetIdx < 0) return false
    // 自由回退：任何之前阶段都允许
    if (targetIdx <= indexOf(project.currentPhase)) return true
    // 前进：必须沿途所有阶段都已完成
    for (let i = 0; i < targetIdx; i++) {
      const phase = PHASE_ORDER[i]
      if (!workflowEngine.getPhaseStatus(project, phase).isComplete) return false
    }
    return true
  },

  getPhaseStatus(project, phase) {
    switch (phase) {
      case 'script':   return statusForScript(project)
      case 'assets':   return statusForAssets(project)
      case 'director': return statusForDirector(project)
      case 'export':   return statusForExport(project)
    }
  },

  getNextPhase(current) {
    const i = indexOf(current)
    if (i < 0 || i >= PHASE_ORDER.length - 1) return null
    return PHASE_ORDER[i + 1]
  },

  getPrevPhase(current) {
    const i = indexOf(current)
    if (i <= 0) return null
    return PHASE_ORDER[i - 1]
  },
}

export const PHASES = PHASE_ORDER
