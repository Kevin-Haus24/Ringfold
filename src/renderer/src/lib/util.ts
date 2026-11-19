import { useEffect, useRef, useState } from 'react'

/** localStorage wrapper that never throws (private mode, blocked storage). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`ringfold.${key}`)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(`ringfold.${key}`, value)
    } catch {
      /* ignore */
    }
  }
}

export function pct(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  const p = (part / whole) * 100
  if (p > 0 && p < 0.1) return '<0.1%'
  return `${p.toFixed(p < 10 ? 1 : 0)}%`
}

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Strip Electron's "Error invoking remote method 'x': Error: " prefix.
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export const isCancelled = (err: unknown): boolean => errorMessage(err) === 'cancelled'

/** Observed size of an element. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}
