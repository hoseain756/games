'use client'

// ---------------------------------------------------------------------------
// "حروف مع حسين" lettering logo — retro sticker style: three stacked words
// (yellow / teal / coral) each with a chunky dark-purple offset shadow and a
// playful tilt, drawn with the app's rounded Arabic display font so the
// lettering stays crisp and correctly spelled at any size (SVG text, no image).
// ---------------------------------------------------------------------------

const SHADOW = '#3b2a5e'

interface LogoWord {
  text: string
  fill: string
  /** Anchor point (horizontal center, baseline) inside the viewBox. */
  x: number
  y: number
  size: number
  rotate: number
}

const WORDS: LogoWord[] = [
  { text: 'حروف', fill: '#ffd21e', x: 252, y: 148, size: 152, rotate: -7.5 },
  { text: 'مع', fill: '#38bcc8', x: 204, y: 260, size: 100, rotate: 4 },
  { text: 'حسين', fill: '#f2545b', x: 258, y: 380, size: 152, rotate: -5 },
]

export function HurufLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 445"
      className={className}
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      role="img"
      aria-label="حروف مع حسين"
    >
      <title>حروف مع حسين</title>
      {WORDS.map(word => (
        <g
          key={word.text}
          transform={`rotate(${word.rotate} ${word.x} ${(word.y - word.size * 0.35).toFixed(1)})`}
        >
          {/* Offset shadow layer (down-left, like the reference lettering) */}
          <text
            x={word.x - 11}
            y={word.y + 11}
            textAnchor="middle"
            fontSize={word.size}
            fontWeight={800}
            fill={SHADOW}
            style={{ userSelect: 'none' }}
          >
            {word.text}
          </text>
          {/* Colored word on top */}
          <text
            x={word.x}
            y={word.y}
            textAnchor="middle"
            fontSize={word.size}
            fontWeight={800}
            fill={word.fill}
            style={{ userSelect: 'none' }}
          >
            {word.text}
          </text>
        </g>
      ))}
    </svg>
  )
}
