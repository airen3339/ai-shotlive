/**
 * LoadingSpinner — 极简胶片旋转，呼应"暗房显影"概念
 */
export function LoadingSpinner({
  label,
  size = 'md',
}: {
  label?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dim = size === 'sm' ? 14 : size === 'lg' ? 36 : 22
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className="relative inline-block"
        style={{ width: dim, height: dim }}
        aria-hidden
      >
        <span
          className="absolute inset-0 rounded-full border border-paper-500/30"
          style={{ borderColor: 'var(--color-ink-500)' }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid transparent`,
            borderTopColor: 'var(--color-amber-leader)',
            borderRightColor: 'var(--color-amber-leader)',
            animation: 'spin 900ms linear infinite',
          }}
        />
      </span>
      {label && (
        <span className="mono text-[0.7rem] tracking-[0.18em] uppercase text-paper-400">
          {label}
        </span>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}
