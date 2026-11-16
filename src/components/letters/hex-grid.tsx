'use client'

import { memo } from 'react'
import type { LettersTeam } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Hexagon board — pointy-top hexagons drawn with SVG so the borders get the
// rounded joins seen in the reference design (white cells, thick purple
// borders, purple letters, colored claimed cells).
// ---------------------------------------------------------------------------

const PURPLE_BORDER = '#7c3aad'
const PURPLE_LETTER = '#6d28d9'
const TEAM_FILL: Record<LettersTeam, string> = { A: '#fbbf24', B: '#f87171' }

/** Isolated forms that read better on the board. */
const LETTER_DISPLAY: Record<string, string> = { ه: 'هـ' }

const S = 100 // hex radius (center -> vertex)
const W = Math.sqrt(3) * S // hex width
const GAP = 1.06 // spacing multiplier -> small gaps between cells
const SPACING_X = W * GAP
const SPACING_Y = 1.5 * S * GAP
const COLS = 7
const MARGIN = 10

const VIEW_W = SPACING_X * (COLS - 1) + SPACING_X / 2 + W + MARGIN * 2
const VIEW_H = SPACING_Y * 3 + 2 * S + MARGIN * 2

function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((-90 + 60 * i) * Math.PI) / 180
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

export interface HexGridProps {
  /** Shuffled 28 letters, positions in board order (row-major). */
  layout: string[]
  /** letter -> owning team (colored cells). */
  claimed?: Record<string, LettersTeam>
  /** Letter of the currently active cell (pulsing highlight). */
  activeLetter?: string | null
  /** Letters currently tappable; null = board is not interactive. */
  selectable?: ReadonlySet<string> | null
  onPick?: (letter: string) => void
  className?: string
  /** Hide letters completely (used for the reveal moment). */
  muted?: boolean
}

function HexGridImpl({
  layout,
  claimed,
  activeLetter,
  selectable,
  onPick,
  className,
  muted = false,
}: HexGridProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W.toFixed(0)} ${VIEW_H.toFixed(0)}`}
      className={className}
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      role="group"
      aria-label="لوحة الحروف السداسية"
    >
      {layout.map((letter, index) => {
        const row = Math.floor(index / COLS)
        const col = index % COLS
        const cx = MARGIN + W / 2 + col * SPACING_X + (row % 2 === 1 ? SPACING_X / 2 : 0)
        const cy = MARGIN + S + row * SPACING_Y
        const owner = claimed?.[letter]
        const isActive = activeLetter === letter
        const canPick = selectable?.has(letter) === true

        const fill = owner ? TEAM_FILL[owner] : '#ffffff'
        const stroke = isActive ? '#f59e0b' : PURPLE_BORDER
        const strokeWidth = isActive ? 16 : 9

        return (
          <g
            key={`${letter}-${index}`}
            onClick={canPick ? () => onPick?.(letter) : undefined}
            className={[
              canPick ? 'cursor-pointer transition-opacity hover:opacity-75' : '',
              isActive ? 'animate-pulse' : '',
            ].join(' ')}
            role={canPick ? 'button' : undefined}
            aria-label={canPick ? `اختر حرف ${letter}` : undefined}
          >
            <polygon
              points={hexPoints(cx, cy, S)}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
            {!muted && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={86}
                fontWeight={800}
                fill={owner ? '#ffffff' : PURPLE_LETTER}
                style={{ userSelect: 'none' }}
              >
                {LETTER_DISPLAY[letter] ?? letter}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const HexGrid = memo(HexGridImpl)

// ---------------------------------------------------------------------------
// Single hexagon badge (scores, active letter chips...).
// ---------------------------------------------------------------------------

export function HexBadge({
  fill,
  stroke,
  label,
  className,
  fontSize = 44,
}: {
  fill: string
  stroke?: string
  label: string
  className?: string
  fontSize?: number
}) {
  const r = 50
  return (
    <svg
      viewBox="-60 -60 120 120"
      className={className}
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      aria-hidden="true"
    >
      <polygon
        points={hexPoints(0, 0, r)}
        fill={fill}
        stroke={stroke ?? PURPLE_BORDER}
        strokeWidth={9}
        strokeLinejoin="round"
      />
      <text
        x={0}
        y={4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={800}
        fill={PURPLE_LETTER}
      >
        {label}
      </text>
    </svg>
  )
}
