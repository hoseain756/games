// ---------------------------------------------------------------------------
// Hex connection board ("وصّل الشريطين") for "حروف مع حسين".
// A 5x5 staircase board of pointy-top hexagons (5 letters per row, 5 rows):
// - Team A (amber) owns the TOP + BOTTOM edges and wins by connecting them.
// - Team B (red) owns the LEFT + RIGHT edges and wins by connecting them.
// Answering a question colors one cell with the answering team's color; the
// first team whose color forms a chain between its two edges wins the game.
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
 * Hex adjacency for a staircase board whose rows shift RIGHT by half a cell
 * per row: horizontal neighbors plus (r+1,c) (r+1,c-1) (r-1,c) (r-1,c+1).
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
  push(r + 1, c)
  push(r + 1, c - 1)
  push(r - 1, c)
  push(r - 1, c + 1)
  return out
}

export interface HexWin {
  team: HexTeam
  /** Cell indices of the winning chain, from one edge to the other. */
  path: number[]
}

/**
 * Returns the winning chain if a team connected its two edges (null while
 * nobody has connected yet). A completely filled Hex board always contains
 * exactly one winning chain, so the game can never end in a draw.
 */
export function findWinningChain(
  claimed: Record<string, HexTeam>,
  layout: readonly string[],
): HexWin | null {
  for (const team of ['A', 'B'] as const) {
    const owner = (index: number) => claimed[layout[index]] === team
    const isStart = (index: number) => (team === 'A' ? cellRow(index) === 0 : cellCol(index) === 0)
    const isGoal = (index: number) =>
      team === 'A' ? cellRow(index) === BOARD_ROWS - 1 : cellCol(index) === BOARD_COLS - 1

    // BFS from every claimed start cell on the team's first edge.
    const parent = new Map<number, number>()
    const queue: number[] = []
    const limit = Math.min(layout.length, BOARD_CELLS)
    for (let i = 0; i < limit; i++) {
      if (owner(i) && isStart(i)) {
        parent.set(i, -1)
        queue.push(i)
      }
    }

    let goal = -1
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]
      if (isGoal(current)) {
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
