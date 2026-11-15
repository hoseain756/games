'use client'

const COLORS = ['#1a56db', '#2563eb', '#1e3a8a', '#0369a1', '#3b82f6', '#334155', '#0ea5e9', '#1d4ed8']

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]
}

interface PlayerLike {
  name: string
  selfie: string
}

export function PlayerAvatar({
  player,
  size = 56,
  className = '',
}: {
  player: PlayerLike
  size?: number
  className?: string
}) {
  if (player.selfie) {
    return (
      <span
        className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-primary/20 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={player.selfie}
          alt={`صورة ${player.name}`}
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  const color = colorFor(player.name)
  const first = [...player.name.trim()][0] ?? '؟'
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        fontSize: size * 0.42,
      }}
    >
      {first}
    </span>
  )
}
