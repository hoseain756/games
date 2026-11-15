/** Shared types between the game UI and the socket.io game service contract. */

export interface PublicPlayer {
  /** Persistent client-generated uuid (not the socket id). */
  id: string
  name: string
  /** Data URL of the selfie; may be '' when the player skipped the photo. */
  selfie: string
  connected: boolean
}

export interface GameOptions {
  /** Do not repeat a question until the whole pool is exhausted. */
  norepeat: boolean
  /** Shuffle player turn order when the game starts. */
  shuffle: boolean
}

export interface TurnState {
  round: number
  /** 1-based position of the current player in the turn order. */
  turnNo: number
  total: number
  currentPlayer: PublicPlayer | null
}

export type RoomState = 'lobby' | 'playing'

export type HostView = 'setup' | 'reconnecting' | 'lobby' | 'game'
export type PlayerView = 'join' | 'reconnecting' | 'wait' | 'play' | 'end'
