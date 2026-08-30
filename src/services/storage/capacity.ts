/**
 * Storage Capacity Monitor — 存储自适应
 *
 * 控制论"涨落-有序律"：通过监控存储容量变化触发自适应清理策略。
 * 存储等级：充足(<50%) / 紧张(50%-80%) / 临界(80%-95%) / 满载(>95%)
 */

export type StorageLevel = 'plentiful' | 'tight' | 'critical' | 'full'

interface StorageEstimate {
  usage: number
  quota: number
  level: StorageLevel
  pctUsed: number
}

// 格式化字节
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// 检测存储等级
function getLevel(pct: number): StorageLevel {
  if (pct > 95) return 'full'
  if (pct > 80) return 'critical'
  if (pct > 50) return 'tight'
  return 'plentiful'
}

// 获取存储估算
export async function getStorageEst(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage ?? 0
    const quota = estimate.quota ?? 0
    if (quota === 0) return null
    const pct = Math.round((usage / quota) * 100)
    return { usage, quota, level: getLevel(pct), pctUsed: pct }
  } catch {
    return null
  }
}

// 生成自适应清理建议
export function getCleanupAdvice(level: StorageLevel): string[] {
  switch (level) {
    case 'full':
      return [
        '存储空间已满！必须立即清理。',
        '1. 导出当前项目备份',
        '2. 删除不再使用的项目',
        '3. 清理历史图片缓存',
      ]
    case 'critical':
      return [
        '存储空间紧张（即将满载）。',
        '1. 导出旧项目备份',
        '2. 清理 7 天前的缓存',
        '3. 删除未引用的资产图片',
      ]
    case 'tight':
      return [
        '存储使用超过 50%。',
        '1. 考虑压缩历史图片',
        '2. 清理过期的临时缓存',
      ]
    default:
      return []
  }
}

// 单次检测 + 清理（按需调用）
export async function checkAndClean(): Promise<{
  estimate: StorageEstimate | null
  cleaned: boolean
}> {
  const estimate = await getStorageEst()
  if (!estimate) return { estimate: null, cleaned: false }
  if (estimate.level === 'plentiful') return { estimate, cleaned: false }

  let cleaned = false

  // 紧张：清理旧项目（7天前更新过的）
  if (estimate.level === 'tight') {
    // 建议性操作，不自动删除
    console.warn('[Storage] usage at', estimate.pctUsed + '%')
    return { estimate, cleaned }
  }

  // 临界/满载：更激进的建议
  if (estimate.level === 'critical' || estimate.level === 'full') {
    console.error('[Storage] usage critical:', estimate.pctUsed + '%')
    return { estimate, cleaned }
  }

  return { estimate, cleaned }
}
