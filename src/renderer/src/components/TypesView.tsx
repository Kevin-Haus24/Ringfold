import { useEffect, useMemo, useState } from 'react'
import type { ExtStat } from '../../../shared/types'
import { useI18n } from '../i18n'
import { CATEGORIES, categoryOfExt, type Category } from '../lib/categories'
import { errorMessage, pct } from '../lib/util'
import { ChevronIcon } from './Icons'

interface Group {
  cat: Category
  size: number
  count: number
  exts: ExtStat[]
}

export function TypesView({ node, version }: { node: number; version: number }) {
  const { t, lang, bytes, num } = useI18n()
  const [exts, setExts] = useState<ExtStat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Category | null>(null)

  useEffect(() => {
    let alive = true
    setExts(null)
    window.api.types(node).then(
      (r) => alive && setExts(r.extensions),
      (e) => alive && setError(errorMessage(e))
    )
    return () => {
      alive = false
    }
  }, [node, version])

  const groups = useMemo(() => {
    const map = new Map<Category, Group>()
    for (const e of exts ?? []) {
      const cat = categoryOfExt(e.ext)
      const g = map.get(cat) ?? { cat, size: 0, count: 0, exts: [] }
      g.size += e.size
      g.count += e.count
      g.exts.push(e)
      map.set(cat, g)
    }
    return [...map.values()].sort((a, b) => b.size - a.size)
  }, [exts])

  if (error) return <div className="panel-message">{error}</div>
  if (!exts) return <div className="panel-message">{t.loading}</div>

  const total = groups.reduce((s, g) => s + g.size, 0)

  return (
    <div className="types-view">
      <div className="section-head">
        <h2>{t.typesTitle}</h2>
        <p>{t.typesSubtitle}</p>
      </div>
      <div className="stacked">
        {groups.map((g) =>
          g.size / Math.max(total, 1) > 0.002 ? (
            <span
              key={g.cat}
              title={`${CATEGORIES[g.cat].label[lang]} · ${bytes(g.size)}`}
              style={{ flexGrow: g.size, background: CATEGORIES[g.cat].color }}
              onClick={() => setOpen(g.cat)}
            />
          ) : null
        )}
      </div>
      <div className="type-list">
        {groups.map((g) => {
          const meta = CATEGORIES[g.cat]
          const expanded = open === g.cat
          return (
            <div key={g.cat} className={`type-group${expanded ? ' open' : ''}`}>
              <button className="type-row" onClick={() => setOpen(expanded ? null : g.cat)}>
                <span className="dot" style={{ background: meta.color }} />
                <span className="type-name">{meta.label[lang]}</span>
                <span className="type-bar">
                  <span style={{ width: `${(g.size / (groups[0]?.size || 1)) * 100}%`, background: meta.color }} />
                </span>
                <span className="num strong">{bytes(g.size)}</span>
                <span className="num muted">{pct(g.size, total)}</span>
                <span className="num muted hide-narrow">{t.filesCount(num(g.count))}</span>
                <ChevronIcon size={16} className="chev" />
              </button>
              {expanded && (
                <div className="ext-list">
                  {g.exts.slice(0, 40).map((e) => (
                    <div key={e.ext} className="ext-row">
                      <span className="ext-name">{e.ext ? `.${e.ext}` : t.noExt}</span>
                      <span className="type-bar">
                        <span style={{ width: `${(e.size / (g.exts[0]?.size || 1)) * 100}%`, background: meta.color }} />
                      </span>
                      <span className="num">{bytes(e.size)}</span>
                      <span className="num muted">{pct(e.size, total)}</span>
                      <span className="num muted hide-narrow">{t.filesCount(num(e.count))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
