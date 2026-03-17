'use client'

export function StatCard({
  title,
  value,
  icon,
  color,
  trend,
}: {
  title: string
  value: number | string
  icon: string
  color: string
  trend: string
}) {
  const display =
    typeof value === 'number'
      ? (Number.isNaN(value) ? 0 : value).toLocaleString()
      : String(value)
  const visibleText = display || '0'
  return (
    <div className="bg-[var(--surface)] border border-[var(--separator)] p-5 rounded-2xl shadow-[var(--shadow-card)]">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg mb-3"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <p
        className="text-3xl font-bold min-h-[1.25em] tabular-nums text-[var(--text)]"
        style={{ color }}
        aria-label={`${title}: ${visibleText}`}
        data-stat-value={visibleText}
      >
        {visibleText}
      </p>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{title}</p>
      <p className="text-xs mt-2 text-[var(--text-muted)]">{trend}</p>
    </div>
  )
}
