'use client'

import { memo } from 'react'
import type { LettersTeam } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Hex CONNECTION board — 5 rows x 5 letters, ALTERNATING honeycomb (odd rows
// pushed right by half a cell space, even rows normal), matching the reference
// design. Every letter is sealed INSIDE a padded square box, and each square
// box is split by an X (both diagonals) into 4 triangles: the two opposite
// triangles pointing up/down carry Team A's green, and the two opposite
// triangles pointing left/right carry Team B's orange — the same X-split as
// the full-bleed frame behind the board (green top + bottom bands, orange
// left + right sides). Claimed cells take the answering team's color inside
// their hexagon; the winning chain glows on victory.
// ---------------------------------------------------------------------------

const PURPLE_BORDER = '#7c3aad'
const PURPLE_LETTER = '#6d28d9'
/** Exact colors sampled from the reference image. */
const GREEN = '#3bb316' // Team A — top + bottom (of every box and of the frame)
const GREEN_DEEP = '#276b12'
const ORANGE = '#ff7836' // Team B — left + right (of every box and of the frame)
const ORANGE_DEEP = '#c2410c'
const TEAM_FILL: Record<LettersTeam, string> = { A: GREEN, B: ORANGE }
const TEAM_DEEP: Record<LettersTeam, string> = { A: GREEN_DEEP, B: ORANGE_DEEP }
const ACTIVE_RING = '#fde047'

/** Isolated forms that read better on the board. */
const LETTER_DISPLAY: Record<string, string> = { ه: 'هـ' }

const L = 100 // square box side (each cell lives inside one box)
const R = 40 // hexagon radius -> padding between the hexagon and its box
const COLS = 5
const ROWS = 5
const PAD_X = 95 // side margin = the visible orange band width
const PAD_Y = 72 // top/bottom margin above the first row of boxes

// Odd rows (2nd and 4th) are pushed RIGHT by half a cell space; even rows sit
// normally — the staggered honeycomb silhouette of the reference image.
const boxX = (row: number, col: number) =>
  PAD_X + col * L + (row % 2 === 1 ? L / 2 : 0)
const boxY = (row: number) => PAD_Y + row * L

// Board extremes (odd rows protrude right by half a box).
const CONTENT_W = COLS * L + L / 2
const CONTENT_H = ROWS * L
const VIEW_W = CONTENT_W + 2 * PAD_X
const VIEW_H = CONTENT_H + 2 * PAD_Y

// Green band geometry: straight edge depth + diagonal corner runs.
const BAND_H = 108
const DIAG = 148

function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((-90 + 60 * i) * Math.PI) / 180
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

export interface HexGridProps {
  /** Shuffled board letters, 25 entries in row-major order. */
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
  /** Letters of the winning chain (game_over): glowing halo. */
  winPath?: ReadonlySet<string> | null
  /** Team that owns the winning chain (halo color). */
  winTeam?: LettersTeam | null
}

function HexGridImpl({
  layout,
  claimed,
  activeLetter,
  selectable,
  onPick,
  className,
  muted = false,
  winPath = null,
  winTeam = null,
}: HexGridProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W.toFixed(0)} ${VIEW_H.toFixed(0)}`}
      className={className}
      style={{ fontFamily: 'var(--font-baloo), var(--font-tajawal), sans-serif' }}
      role="group"
      aria-label="لوحة الحروف السداسية — صِل شريط فريقك"
    >
      {/* Full-bleed frame: orange base (Team B sides) + green top/bottom bands (Team A) */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={ORANGE} />
      <polygon
        points={`0,0 ${VIEW_W.toFixed(0)},0 ${(VIEW_W - DIAG).toFixed(0)},${BAND_H} ${DIAG},${BAND_H}`}
        fill={GREEN}
      />
      <polygon
        points={`${DIAG},${(VIEW_H - BAND_H).toFixed(0)} ${(VIEW_W - DIAG).toFixed(0)},${(VIEW_H - BAND_H).toFixed(0)} ${VIEW_W.toFixed(0)},${VIEW_H.toFixed(0)} 0,${VIEW_H.toFixed(0)}`}
        fill={GREEN}
      />

      {layout.map((letter, index) => {
        const row = Math.floor(index / COLS)
        const col = index % COLS
        const x0 = boxX(row, col)
        const y0 = boxY(row)
        const x1 = x0 + L
        const y1 = y0 + L
        const cx = x0 + L / 2
        const cy = y0 + L / 2

        const owner = claimed?.[letter]
        const isActive = activeLetter === letter
        const canPick = selectable?.has(letter) === true
        const inWin = winPath?.has(letter) === true && winTeam

        const fill = owner ? TEAM_FILL[owner] : '#ffffff'
        const highlight = isActive && !inWin
        const stroke = highlight ? ACTIVE_RING : PURPLE_BORDER
        const strokeWidth = highlight ? 8 : 6

        return (
          <g
            key={`${letter}-${index}`}
            onClick={canPick ? () => onPick?.(letter) : undefined}
            className={canPick ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}
            role={canPick ? 'button' : undefined}
            aria-label={canPick ? `اختر حرف ${letter}` : undefined}
          >
            {/* Square box split by an X into 4 triangles:
                top + bottom triangles = Team A green, left + right = Team B orange */}
            <polygon points={`${x0},${y0} ${x1},${y0} ${cx},${cy}`} fill={GREEN} />
            <polygon points={`${x0},${y1} ${x1},${y1} ${cx},${cy}`} fill={GREEN} />
            <polygon points={`${x0},${y0} ${x0},${y1} ${cx},${cy}`} fill={ORANGE} />
            <polygon points={`${x1},${y0} ${x1},${y1} ${cx},${cy}`} fill={ORANGE} />

            {isActive && !inWin && (
              <polygon
                points={hexPoints(cx, cy, R)}
                fill="none"
                stroke={ACTIVE_RING}
                strokeWidth={14}
                strokeLinejoin="round"
                className="animate-pulse"
              />
            )}
            {inWin && winTeam && (
              <polygon
                points={hexPoints(cx, cy, R)}
                fill="none"
                stroke={TEAM_DEEP[winTeam]}
                strokeWidth={14}
                strokeLinejoin="round"
                opacity={0.6}
              />
            )}
            <polygon
              points={hexPoints(cx, cy, R)}
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
                fontSize={38}
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
        fill="#ffffff"
      >
        {label}
      </text>
    </svg>
  )
}
