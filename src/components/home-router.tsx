'use client'

import { useSearchParams } from 'next/navigation'
import { AppHome } from '@/components/app-home'
import { PhotoGameRoot } from '@/components/game/photo-game-root'
import { LettersGame } from '@/components/letters/letters-game'

/**
 * Client-side router over a single Next.js route (`/`):
 * - `/`                    -> home menu with both games
 * - `/?game=photo`         -> the selfie/question QR game
 * - `/?game=huruf&role=..` -> "حروف مع حسين" screens (host/teamA/teamB/display)
 */
export function HomeRouter() {
  const params = useSearchParams()
  const game = params.get('game')

  if (game === 'photo') return <PhotoGameRoot />
  if (game === 'huruf')
    return <LettersGame roleParam={params.get('role')} codeParam={params.get('code')} />
  return <AppHome />
}
