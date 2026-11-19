import { useEffect, useMemo, useState } from 'react'
import type { DupesProgress, DupesResult } from '../../../shared/types'
import { useI18n } from '../i18n'
import { CATEGORIES, categoryOf } from '../lib/categories'
import { errorMessage, isCancelled } from '../lib/util'
import type { MenuTarget } from './ContextMenu'
import { DupesIcon, FileIcon, MoreIcon, RevealIcon, TrashIcon } from './Icons'

const SIZES = [
  { label: '100 KB', value: 100 * 1024 },
  { label: '1 MB', value: 1 << 20 },
  { label: '10 MB', value: 10 << 20 },
  { label: '100 MB', value: 100 << 20 },
  { label: '1 GB', value: 1 << 30 }
]

interface Props {
  node: number
  removed: Set<number>
  onTrash(target: MenuTarget): void
  onContext(e: React.MouseEvent, target: MenuTarget): void
}

export function Duplicates({ node, removed, onTrash, onContext }: Props) {
  const { t, fileManager, bytes, num } = useI18n()
  const [minSize, setMinSize] = useState(1 << 20)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<DupesProgress | null>(null)
  const [result, setResult] = useState<DupesResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => window.api.onDupesProgress(setProgress), [])
  // A new folder means old results no longer apply.
  useEffect(() => {
    setResult(null)
    setError(null)
  }, [node])

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    setProgress(null)
    try {
      setResult(await window.api.duplicates(node, minSize))
    } catch (e) {
      if (!isCancelled(e)) setError(errorMessage(e))
    } finally {
      setRunning(false)
    }
  }

  // Hide files the user already trashed; drop groups with nothing left to compare.
  const groups = useMemo(
    () =>
      (result?.groups ?? [])
        .map((g) => ({ ...g, files: g.files.filter((f) => !removed.has(f.id)) }))
        .filter((g) => g.files.length > 1),
    [result, removed]
  )
  const wasted = groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0)
  const ratio = progress && progress.totalBytes > 0 ? progress.doneBytes / progress.totalBytes : 0

  return (
    <div className="dupes">
      <div className="section-head">
        <h2>{t.dupesTitle}</h2>
        <p>{t.dupesSubtitle}</p>
      </div>
      <div className="dupes-controls">
        <label>
          {t.dupesMin}
          <div className="segmented">
            {SIZES.map((s) => (
              <button
                key={s.value}
                className={minSize === s.value ? 'active' : ''}
                disabled={running}
                onClick={() => setMinSize(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </label>
        {running ? (
          <button className="btn" onClick={() => window.api.cancel()}>
            {t.cancel}
          </button>
        ) : (
          <button className="btn primary" onClick={run}>
            <DupesIcon size={16} /> {result ? t.dupesAgain : t.dupesFind}
          </button>
        )}
      </div>

      {running && (
        <div className="dupes-progress">
          <div className="meter accent">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <div className="muted">
            {progress?.stage === 2 ? t.dupesStage2 : t.dupesStage1}
            {progress && ` · ${num(progress.doneFiles)} / ${num(progress.totalFiles)} · ${bytes(progress.doneBytes)}`}
          </div>
        </div>
      )}
      {error && <div className="panel-message">{error}</div>}

      {result && !running && (
        <>
          <div className="dupes-summary">
            {groups.length === 0 ? t.dupesNone : t.dupesSummary(num(groups.length), bytes(wasted))}
            {result.totalGroups > result.groups.length && <small> · {t.dupesShown(num(result.groups.length))}</small>}
          </div>
          <div className="dupe-groups">
            {groups.map((g) => {
              const color = CATEGORIES[categoryOf(g.files[0].name)].color
              return (
                <div key={`${g.size}-${g.files[0].id}`} className="dupe-group">
                  <div className="dupe-head">
                    <span className="icon" style={{ color }}>
                      <FileIcon size={18} />
                    </span>
                    <strong title={g.files[0].name}>{g.files[0].name}</strong>
                    <span className="muted">{t.dupesGroup(g.files.length, bytes(g.size))}</span>
                    <span className="pill">{t.dupesWasted(bytes(g.size * (g.files.length - 1)))}</span>
                  </div>
                  {g.files.map((f) => {
                    const target = { id: f.id, name: f.name, isDir: false }
                    return (
                      <div key={f.id} className="dupe-file" onContextMenu={(e) => onContext(e, target)}>
                        <span className="file-path" title={f.path}>
                          <bdi>{f.path}</bdi>
                        </span>
                        <button className="icon-btn" title={t.actReveal(fileManager)} onClick={() => window.api.reveal(f.id)}>
                          <RevealIcon size={16} />
                        </button>
                        <button className="icon-btn danger" title={t.actTrash} onClick={() => onTrash(target)}>
                          <TrashIcon size={16} />
                        </button>
                        <button className="icon-btn" onClick={(e) => onContext(e, target)}>
                          <MoreIcon size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
