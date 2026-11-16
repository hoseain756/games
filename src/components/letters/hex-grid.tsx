'use client'

import { memo } from 'react'
import type { LettersTeam } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Hex CONNECTION board — 5 rows x 5 letters, ALTERNATING honeycomb (odd rows
// pushed right by half a cell space, even rows normal), matching the reference
// design. The hexagons are PACKED — edge to edge with no gaps between cells —
// sitting on a full-bleed frame that is split like an X into 4 triangles: the
// top + bottom carry Team A's green and the left + right carry Team B's
// orange. Claimed cells take the answering team's color; the winning chain
// glows on victory.
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

const R = 90 // hexagon radius — sized so neighbouring cells TOUCH
const W = Math.sqrt(3) * R // hexagon width = horizontal pitch (no gaps)
const ROW_H = 1.5 * R // vertical pitch of a packed honeycomb
const COLS = 5
const ROWS = 5
// ONE uniform padding on all four sides of the big box, so the cell cluster
// sits exactly in the middle of it (equal margin left/right/top/bottom).
const PAD = 110

// Odd rows (2nd and 4th) are pushed RIGHT by half a cell space; even rows sit
// normally — the staggered honeycomb silhouette of the reference image.
const cellCx = (row: number, col: number) =>
  PAD + W / 2 + col * W + (row % 2 === 1 ? W / 2 : 0)
const cellCy = (row: number) => PAD + R + row * ROW_H

// Board extremes (odd rows protrude right by half a cell).
const MAX_X = PAD + (COLS + 0.5) * W
const MAX_Y = PAD + R + (ROWS - 1) * ROW_H + R

const VIEW_W = MAX_X
const VIEW_H = MAX_Y

// Green band geometry: straight edge depth + diagonal corner runs. The bands
// run slightly deeper than PAD so the top/bottom rows nestle into the green,
// exactly like the reference image.
const BAND_H = 148
const DIAG = 155

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
        const cx = cellCx(row, col)
        const cy = cellCy(row)

        const owner = claimed?.[letter]
        const isActive = activeLetter === letter
        const canPick = selectable?.has(letter) === true
        const inWin = winPath?.has(letter) === true && winTeam

        const fill = owner ? TEAM_FILL[owner] : '#ffffff'
        const highlight = isActive && !inWin
        const stroke = highlight ? ACTIVE_RING : PURPLE_BORDER
        const strokeWidth = highlight ? 12 : 9

        return (
          <g
            key={`${letter}-${index}`}
            onClick={canPick ? () => onPick?.(letter) : undefined}
            className={canPick ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}
            role={canPick ? 'button' : undefined}
            aria-label={canPick ? `اختر حرف ${letter}` : undefined}
          >
            {isActive && !inWin && (
              <polygon
                points={hexPoints(cx, cy, R)}
                fill="none"
                stroke={ACTIVE_RING}
                strokeWidth={26}
                strokeLinejoin="round"
                className="animate-pulse"
              />
            )}
            {inWin && winTeam && (
              <polygon
                points={hexPoints(cx, cy, R)}
                fill="none"
                stroke={TEAM_DEEP[winTeam]}
                strokeWidth={26}
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
                fontSize={74}
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
