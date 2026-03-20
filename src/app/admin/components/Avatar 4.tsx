'use client'

export function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-[var(--surface)] flex items-center justify-center text-lg"
      style={{ width: size, height: size }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}
