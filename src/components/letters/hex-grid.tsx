'use client'

import { memo } from 'react'
import type { LettersTeam } from '@/lib/letters-types'

// ---------------------------------------------------------------------------
// Hex CONNECTION board — 5 rows x 5 letters, staircase layout (classic Hex).
// Amber bars hug the TOP + BOTTOM edges (Team A must connect them), red bars
// hug the LEFT + RIGHT edges (Team B must connect them). Claimed cells take
// the answering team's color; the winning chain glows on victory.
// ---------------------------------------------------------------------------

const PURPLE_BORDER = '#7c3aad'
const PURPLE_LETTER = '#6d28d9'
const TEAM_FILL: Record<LettersTeam, string> = { A: '#fbbf24', B: '#f87171' }
const TEAM_DEEP: Record<LettersTeam, string> = { A: '#b45309', B: '#b91c1c' }
const A_BAR = '#f59e0b'
const A_BAR_DEEP = '#92400e'
const B_BAR = '#ef4444'
const B_BAR_DEEP = '#991b1b'

/** Isolated forms that read better on the board. */
const LETTER_DISPLAY: Record<string, string> = { ه: 'هـ' }

const S = 100 // hex radius (center -> vertex)
const W = Math.sqrt(3) * S // hex width
const GAP = 1.04 // spacing multiplier -> small gaps between cells
const SX = W * GAP
const SY = 1.5 * S * GAP
const COLS = 5
const PAD = 16
const BAR_T = 20 // edge bar thickness
const BAR_OFF = 12 // gap between the bars and the cells

// Rows shift RIGHT by half a cell per row (staircase).
const cellCx = (row: number, col: number) => PAD + W / 2 + col * SX + row * (SX / 2)
const cellCy = (row: number) => PAD + S + row * SY

// Board extremes.
const TOP_LEFT = PAD
const TOP_RIGHT = PAD + (COLS - 1) * SX + W
const BOT_LEFT = PAD + ((COLS - 1) * SX) / 2
const BOT_RIGHT = BOT_LEFT + (COLS - 1) * SX + W
const MIN_X = TOP_LEFT
const MAX_X = BOT_RIGHT
const MIN_Y = PAD
const MAX_Y = PAD + 2 * S + (COLS - 1) * SY

const VIEW_W = MAX_X + BAR_OFF + BAR_T + PAD
const VIEW_H = MAX_Y + BAR_OFF + BAR_T + PAD

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
      {/* Team edge bars: A = top + bottom, B = left + right */}
      <rect
        x={TOP_LEFT}
        y={MIN_Y - BAR_OFF - BAR_T}
        width={TOP_RIGHT - TOP_LEFT}
        height={BAR_T}
        rx={BAR_T / 2}
        fill={A_BAR}
        stroke={A_BAR_DEEP}
        strokeWidth={3}
      />
      <rect
        x={BOT_LEFT}
        y={MAX_Y + BAR_OFF}
        width={BOT_RIGHT - BOT_LEFT}
        height={BAR_T}
        rx={BAR_T / 2}
        fill={A_BAR}
        stroke={A_BAR_DEEP}
        strokeWidth={3}
      />
      <rect
        x={MIN_X - BAR_OFF - BAR_T}
        y={MIN_Y}
        width={BAR_T}
        height={MAX_Y - MIN_Y}
        rx={BAR_T / 2}
        fill={B_BAR}
        stroke={B_BAR_DEEP}
        strokeWidth={3}
      />
      <rect
        x={MAX_X + BAR_OFF}
        y={MIN_Y}
        width={BAR_T}
        height={MAX_Y - MIN_Y}
        rx={BAR_T / 2}
        fill={B_BAR}
        stroke={B_BAR_DEEP}
        strokeWidth={3}
      />

      {layout.map((letter, index) => {
        const row = Math.floor(index / COLS)
        const col = index % COLS
        const x = cellCx(row, col)
        const y = cellCy(row)
        const owner = claimed?.[letter]
        const isActive = activeLetter === letter
        const canPick = selectable?.has(letter) === true
        const inWin = winPath?.has(letter) === true && winTeam

        const fill = owner ? TEAM_FILL[owner] : '#ffffff'
        const stroke = isActive ? '#f59e0b' : PURPLE_BORDER
        const strokeWidth = isActive ? 16 : 9

        return (
          <g
            key={`${letter}-${index}`}
            onClick={canPick ? () => onPick?.(letter) : undefined}
            className={[
              canPick ? 'cursor-pointer transition-opacity hover:opacity-75' : '',
              isActive || inWin ? 'animate-pulse' : '',
            ].join(' ')}
            role={canPick ? 'button' : undefined}
            aria-label={canPick ? `اختر حرف ${letter}` : undefined}
          >
            {inWin && winTeam && (
              <polygon
                points={hexPoints(x, y, S)}
                fill="none"
                stroke={TEAM_DEEP[winTeam]}
                strokeWidth={30}
                strokeLinejoin="round"
                opacity={0.6}
              />
            )}
            <polygon
              points={hexPoints(x, y, S)}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
            {!muted && (
              <text
                x={x}
                y={y}
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
