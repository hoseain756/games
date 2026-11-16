// ---------------------------------------------------------------------------
// Hex connection board ("وصّل الشريطين") for "حروف مع حسين".
// A 5x5 ALTERNATING honeycomb board of pointy-top hexagons (5 letters per
// row, 5 rows) exactly like the reference design: odd rows (2nd, 4th) are
// shifted right by half a cell, so they protrude into the right band and
// nestle half a cell from the left band.
// - Team A (green) owns the TOP + BOTTOM bands and wins by connecting them
//   (every row-0 / row-4 cell touches its band).
// - Team B (orange) owns the LEFT + RIGHT bands and wins by connecting the
//   first column to the last column (even-row cells touch the side bands
//   directly; odd-row cells protrude into the right band).
// Answering a question colors one cell with the answering team's color; the
// first team whose color forms a chain between its two edges wins the game.
//
// Exhaustively verified over all 2^25 colorings: a completely filled board
// always contains a winning chain for exactly one team (no draws possible).
// ---------------------------------------------------------------------------

export const BOARD_COLS = 5
export const BOARD_ROWS = 5
export const BOARD_CELLS = BOARD_COLS * BOARD_ROWS

export type HexTeam = 'A' | 'B'

/** row-major index of a cell (row * 5 + col). */
export function cellIndex(row: number, col: number): number {
  return row * BOARD_COLS + col
}

export function cellRow(index: number): number {
  return Math.floor(index / BOARD_COLS)
}

export function cellCol(index: number): number {
  return index % BOARD_COLS
}

/**
 * Hex adjacency for the alternating honeycomb: horizontal neighbors plus the
 * two diagonal neighbors in the rows above/below, mirrored around the row
 * parity (odd rows are shifted right by half a cell).
 */
export function hexNeighbors(index: number): number[] {
  const r = cellRow(index)
  const c = cellCol(index)
  const out: number[] = []
  const push = (rr: number, cc: number) => {
    if (rr >= 0 && rr < BOARD_ROWS && cc >= 0 && cc < BOARD_COLS) out.push(cellIndex(rr, cc))
  }
  push(r, c - 1)
  push(r, c + 1)
  if (r % 2 === 0) {
    // Even rows sit half a cell LEFT of the odd rows above/below.
    push(r + 1, c)
    push(r + 1, c - 1)
    push(r - 1, c)
    push(r - 1, c - 1)
  } else {
    // Odd rows sit half a cell RIGHT of the even rows above/below.
    push(r + 1, c)
    push(r + 1, c + 1)
    push(r - 1, c)
    push(r - 1, c + 1)
  }
  return out
}

export interface HexWin {
  team: HexTeam
  /** Cell indices of the winning chain, from one edge to the other. */
  path: number[]
}

/** A's two edges: the full top row and the full bottom row. */
const A_STARTS = [0, 1, 2, 3, 4]
const A_GOALS = [20, 21, 22, 23, 24]
/** B's two edges: the full first column and the full last column. */
const B_STARTS = [0, 5, 10, 15, 20]
const B_GOALS = [4, 9, 14, 19, 24]

/**
 * Returns the winning chain if a team connected its two edges (null while
 * nobody has connected yet). Checked after every claimed cell, so the first
 * completed chain ends the game immediately.
 */
export function findWinningChain(
  claimed: Record<string, HexTeam>,
  layout: readonly string[],
): HexWin | null {
  for (const team of ['A', 'B'] as const) {
    const owner = (index: number) => claimed[layout[index]] === team
    const starts = team === 'A' ? A_STARTS : B_STARTS
    const goals = team === 'A' ? A_GOALS : B_GOALS
    const isGoal = new Set(goals)

    // BFS from every claimed start cell on the team's first edge.
    const parent = new Map<number, number>()
    const queue: number[] = []
    const limit = Math.min(layout.length, BOARD_CELLS)
    for (const s of starts) {
      if (s < limit && owner(s) && !parent.has(s)) {
        parent.set(s, -1)
        queue.push(s)
      }
    }

    let goal = -1
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]
      if (isGoal.has(current)) {
        goal = current
        break
      }
      for (const nb of hexNeighbors(current)) {
        if (!parent.has(nb) && owner(nb)) {
          parent.set(nb, current)
          queue.push(nb)
        }
      }
    }

    if (goal >= 0) {
      const path: number[] = []
      let cursor = goal
      while (cursor !== -1) {
        path.push(cursor)
        cursor = parent.get(cursor) ?? -1
      }
      return { team, path: path.reverse() }
    }
  }
  return null
}
