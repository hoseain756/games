// ---------------------------------------------------------------------------
// Engine host — starts the two real-time game engines (letters 3004, questions
// 3003) inside the Next.js server process.
//
// The sandbox reaps standalone background processes between terminal commands,
// while the Next.js dev server is the only supervised long-lived process, so
// the engines live there. In supervised environments the standalone
// mini-services own the ports first and the in-app hosts stand aside
// (EADDRINUSE tolerated by both engines).
//
// Guards:
// - globalThis flag set synchronously (HMR-safe, no double-start).
// - Both engines handle EADDRINUSE quietly.
// Never imported from client components.
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & {
  __lettersEnginesStarted?: boolean
}

export function ensureGameEngines(): void {
  if (g.__lettersEnginesStarted) return
  g.__lettersEnginesStarted = true

  void (async () => {
    try {
      const [{ startLettersEngine }, { startGameEngine }] = await Promise.all([
        import('./letters-engine'),
        import('./game-engine'),
      ])
      startLettersEngine(3004)
      startGameEngine(3003)
    } catch (err) {
      g.__lettersEnginesStarted = false
      console.error('[engine-host] failed to start game engines:', err)
    }
  })()
}
