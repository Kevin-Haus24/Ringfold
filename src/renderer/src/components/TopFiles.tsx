import { useEffect, useState } from 'react'
import type { FileEntry, NodeSummary } from '../../../shared/types'
import { useI18n } from '../i18n'
import { CATEGORIES, categoryOf } from '../lib/categories'
import { errorMessage } from '../lib/util'
import { FileIcon, MoreIcon } from './Icons'

const LIMIT = 200

interface Props {
  node: number
  version: number
  onContext(e: React.MouseEvent, node: NodeSummary): void
}

export function TopFiles({ node, version, onContext }: Props) {
  const { t, lang, bytes, num, date } = useI18n()
  const [files, setFiles] = useState<FileEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.top(node, LIMIT).then(
      (r) => alive && setFiles(r.files),
      (e) => alive && setError(errorMessage(e))
    )
    return () => {
      alive = false
    }
  }, [node, version])

  if (error) return <div className="panel-message">{error}</div>
  if (!files) return <div className="panel-message">{t.loading}</div>

  const largest = files[0]?.size ?? 1
  return (
    <div className="top-files">
      <div className="section-head">
        <h2>{t.topTitle}</h2>
        <p>{t.topSubtitle(num(LIMIT))}</p>
      </div>
      <div className="file-table">
        {files.map((f, i) => {
          const cat = CATEGORIES[categoryOf(f.name)]
          const dir = f.path.slice(0, f.path.length - f.name.length)
          return (
            <div
              key={f.id}
              className="file-row"
              onDoubleClick={() => window.api.open(f.id)}
              onContextMenu={(e) => onContext(e, f)}
            >
              <span className="rank">{i + 1}</span>
              <span className="icon" style={{ color: cat.color }} title={cat.label[lang]}>
                <FileIcon size={18} />
              </span>
              <span className="file-main">
                <span className="file-name" title={f.name}>
                  {f.name}
                </span>
                <span className="file-path" title={f.path}>
                  <bdi>{dir}</bdi>
                </span>
              </span>
              <span className="file-bar">
                <span style={{ width: `${(f.size / largest) * 100}%`, background: cat.color }} />
              </span>
              <span className="num strong">{bytes(f.size)}</span>
              <span className="num muted hide-narrow">{date(f.mtime)}</span>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onContext(e, f)
                }}
              >
                <MoreIcon size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
