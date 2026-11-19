import type { Lang } from './types'

const UNITS: Record<Lang, string[]> = {
  ru: ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'],
  en: ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
}

/** Human-readable size using 1024 steps, the way file managers show it. */
export function formatBytes(bytes: number, lang: Lang = 'en'): string {
  const units = UNITS[lang]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  const digits = i === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  const num = value.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
  return `${num} ${units[i]}`
}
