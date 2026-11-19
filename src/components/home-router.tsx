'use client'

import { useSearchParams } from 'next/navigation'
import { AppHome } from '@/components/app-home'
import { PhotoGameRoot } from '@/components/game/photo-game-root'
import { LettersGame } from '@/components/letters/letters-game'

/**
 * Client-side router over a single Next.js route (`/`):
 * - `/`                    -> home menu with both games
 * - `/?game=photo`         -> the selfie/question QR game
 * - `/?room=CODE`          -> photo-game PLAYER join (what the scanned QR opens)
 * - `/?game=huruf&role=..` -> "حروف مع حسين" screens (host/teamA/teamB/display)
 */
export function HomeRouter() {
  const params = useSearchParams()
  const game = params.get('game')
  const room = params.get('room')

  // A scanned room QR must land straight on the player join screen — never
  // on the home menu (PhotoGameRoot consumes the `room` param on boot).
  if (game === 'photo' || room) return <PhotoGameRoot />
  if (game === 'huruf')
    return <LettersGame roleParam={params.get('role')} codeParam={params.get('code')} />
  return <AppHome />
}
