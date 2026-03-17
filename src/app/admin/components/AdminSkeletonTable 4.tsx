'use client'

export function AdminSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--separator)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--separator)]">
            <th className="text-left p-3">
              <div className="h-4 w-24 bg-[var(--surface-hover)] rounded animate-pulse" />
            </th>
            <th className="text-left p-3">
              <div className="h-4 w-20 bg-[var(--surface-hover)] rounded animate-pulse" />
            </th>
            <th className="text-left p-3">
              <div className="h-4 w-16 bg-[var(--surface-hover)] rounded animate-pulse" />
            </th>
            <th className="text-left p-3">
              <div className="h-4 w-20 bg-[var(--surface-hover)] rounded animate-pulse" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-[var(--separator)]">
              <td className="p-3">
                <div className="h-4 w-32 bg-[var(--surface-hover)]/80 rounded animate-pulse" />
              </td>
              <td className="p-3">
                <div className="h-4 w-28 bg-[var(--surface-hover)]/80 rounded animate-pulse" />
              </td>
              <td className="p-3">
                <div className="h-4 w-24 bg-[var(--surface-hover)]/80 rounded animate-pulse" />
              </td>
              <td className="p-3">
                <div className="h-4 w-28 bg-[var(--surface-hover)]/80 rounded animate-pulse" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
