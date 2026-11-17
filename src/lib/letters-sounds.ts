'use client'

// ---------------------------------------------------------------------------
// Tiny Web-Audio sound kit for "حروف مع حسين" — everything is synthesized on
// the fly (no audio assets except the TTS voice alert), so sounds start with
// zero network latency and work offline.
//
// Browsers block audio until the first user gesture: call `unlockAudio()` on
// any pointerdown/keydown (every screen registers one on mount).
// ---------------------------------------------------------------------------

export type GameSound = 'bell' | 'tick' | 'correct' | 'wrong' | 'fanfare'

let ctx: AudioContext | null = null
let muted = false

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
  return ctx
}

/** Call once from any user gesture to allow later autoplay-style alerts. */
export function unlockAudio() {
  ensureCtx()
}

export function setSoundsMuted(value: boolean) {
  muted = value
}

export function areSoundsMuted() {
  return muted
}

/** One synthesized tone with a quick attack + exponential decay envelope. */
function tone(
  ac: AudioContext,
  at: number,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  peak = 0.18,
) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(at)
  osc.stop(at + duration + 0.05)
}

export function playSound(name: GameSound) {
  if (muted) return
  const ac = ensureCtx()
  if (!ac || ac.state === 'closed') return
  const t = ac.currentTime + 0.01

  switch (name) {
    // Two-note chime when a turn opens / it is a team's moment.
    case 'bell':
      tone(ac, t, 880, 0.45, 'sine', 0.16)
      tone(ac, t + 0.12, 1174.66, 0.6, 'sine', 0.14)
      break
    // Countdown tick for the last 5 seconds.
    case 'tick':
      tone(ac, t, 1050, 0.06, 'square', 0.07)
      break
    // Correct judgment: rising C5-E5-G5 arpeggio.
    case 'correct':
      tone(ac, t, 523.25, 0.16, 'triangle', 0.2)
      tone(ac, t + 0.11, 659.25, 0.16, 'triangle', 0.2)
      tone(ac, t + 0.22, 783.99, 0.3, 'triangle', 0.2)
      break
    // Wrong judgment: short descending buzz.
    case 'wrong':
      tone(ac, t, 220, 0.22, 'sawtooth', 0.14)
      tone(ac, t + 0.16, 150, 0.3, 'sawtooth', 0.14)
      break
    // Whole-game win: quick fanfare run + chord.
    case 'fanfare':
      tone(ac, t, 523.25, 0.14, 'triangle', 0.2)
      tone(ac, t + 0.12, 659.25, 0.14, 'triangle', 0.2)
      tone(ac, t + 0.24, 783.99, 0.14, 'triangle', 0.2)
      tone(ac, t + 0.36, 1046.5, 0.5, 'triangle', 0.22)
      tone(ac, t + 0.36, 659.25, 0.5, 'sine', 0.12)
      tone(ac, t + 0.36, 783.99, 0.5, 'sine', 0.12)
      break
  }
}

/**
 * Voice alert "دوركم الآن!" (TTS-generated wav served from /sounds).
 * Phones require a prior gesture for audio; failures fail silently — the
 * synthesized chime + vibration still fire.
 */
export function playVoiceTurnAlert() {
  if (muted) return
  if (typeof window === 'undefined') return
  try {
    const audio = new Audio('/sounds/turn-alert.wav')
    audio.volume = 1
    void audio.play().catch(() => {})
  } catch {
    // ignore — vibration/chime remain as fallbacks
  }
}

/** Vibration pattern for "your turn" alerts (no-op on iOS Safari). */
export function vibrateTurnAlert() {
  if (typeof navigator === 'undefined') return
  const vibrate = navigator.vibrate?.bind(navigator)
  if (typeof vibrate === 'function') {
    try {
      vibrate([180, 90, 180])
    } catch {
      // ignore
    }
  }
}
