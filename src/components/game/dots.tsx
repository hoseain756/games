'use client'

export function ProgressDots({
  total,
  current,
}: {
  total: number
  /** 0-based index of the current position. */
  current: number
}) {
  if (total > 24) {
    return <span className="text-sm text-muted-foreground">{current + 1} / {total}</span>
  }
  return (
    <div className="flex flex-wrap justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`size-2 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-[var(--accent2)]'
              : i === current
                ? 'scale-150 bg-primary'
                : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}
