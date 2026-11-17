'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly animates a number from its previous value to the new one
 * (ease-out cubic). Used for the display-screen score counters so points
 * visibly "count up" instead of jumping.
 */
export function useAnimatedNumber(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value)
  const currentRef = useRef(value)

  useEffect(() => {
    const from = currentRef.current
    if (from === value) return

    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const progress = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(from + (value - from) * eased)
      currentRef.current = next
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return display
}
