import type { NodeSummary, NodeView } from '../../../shared/types'
import { useI18n } from '../i18n'
import { CATEGORIES, categoryOf } from '../lib/categories'
import { OTHER_COLOR, type Colored } from '../lib/colors'
import { pct } from '../lib/util'
import { FileIcon, FolderIcon, MoreIcon } from './Icons'

interface Props {
  view: NodeView
  colors: Map<number, Colored>
  hovered: number | null
  onHover(id: number | null): void
  onOpen(node: NodeSummary): void
  onContext(e: React.MouseEvent, node: NodeSummary): void
}

export function SizeList({ view, colors, hovered, onHover, onOpen, onContext }: Props) {
  const { t, bytes, num, date } = useI18n()
  const total = view.node.size
  const largest = view.children[0]?.size ?? 0

  return (
    <div className="size-list" onMouseLeave={() => onHover(null)}>
      <div className="row row-head">
        <span>{t.colName}</span>
        <span className="num">{t.colSize}</span>
        <span className="num">{t.colShare}</span>
        <span className="num hide-narrow">{t.colItems}</span>
        <span className="num hide-narrow">{t.colModified}</span>
        <span />
      </div>
      <div className="rows">
        {view.children.length === 0 && <div className="empty">{t.emptyFolder}</div>}
        {view.children.map((n) => {
          const color = colors.get(n.id)?.color ?? (n.isDir ? OTHER_COLOR : CATEGORIES[categoryOf(n.name)].color)
          const barWidth = largest > 0 ? (n.size / largest) * 100 : 0
          return (
            <div
              key={n.id}
              className={`row${hovered === n.id ? ' row-hover' : ''}${n.isDir ? ' row-dir' : ''}`}
              onMouseEnter={() => onHover(n.id)}
              onClick={() => n.isDir && onOpen(n)}
              onDoubleClick={() => !n.isDir && onOpen(n)}
              onContextMenu={(e) => onContext(e, n)}
            >
              <span className="name">
                <span className="bar" style={{ width: `${barWidth}%`, background: color }} />
                <span className="icon" style={{ color }}>
                  {n.isDir ? <FolderIcon size={16} /> : <FileIcon size={16} />}
                </span>
                <span className="label" title={n.name}>
                  {n.name}
                </span>
              </span>
              <span className="num strong">{bytes(n.size)}</span>
              <span className="num muted">{pct(n.size, total)}</span>
              <span className="num muted hide-narrow">{n.isDir ? num(n.files) : ''}</span>
              <span className="num muted hide-narrow">{date(n.mtime)}</span>
              <button
                className="icon-btn row-more"
                onClick={(e) => {
                  e.stopPropagation()
                  onContext(e, n)
                }}
              >
                <MoreIcon size={16} />
              </button>
            </div>
          )
        })}
        {view.more.count > 0 && <div className="row-more-info">{t.moreItems(num(view.more.count), bytes(view.more.size))}</div>}
      </div>
    </div>
  )
}
