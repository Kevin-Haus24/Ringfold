import { useMemo } from 'react'
import type { TreeNode } from '../../../shared/types'
import { useI18n } from '../i18n'
import { OTHER_COLOR, type Colored } from '../lib/colors'
import { pct, useSize } from '../lib/util'

interface Segment {
  key: string
  node?: TreeNode
  other?: { count: number; size: number }
  depth: number
  a0: number
  a1: number
}

function layout(root: TreeNode): { segments: Segment[]; maxDepth: number; parents: Map<number, number> } {
  const segments: Segment[] = []
  const parents = new Map<number, number>()
  let maxDepth = 1
  const walk = (node: TreeNode, depth: number, a0: number, a1: number): void => {
    if (!node.size) return
    const span = a1 - a0
    let a = a0
    for (const child of node.children ?? []) {
      const da = (span * child.size) / node.size
      parents.set(child.id, node.id)
      segments.push({ key: String(child.id), node: child, depth, a0: a, a1: a + da })
      maxDepth = Math.max(maxDepth, depth)
      walk(child, depth + 1, a, a + da)
      a += da
    }
    if (node.other && node.other.size > 0) {
      const da = (span * node.other.size) / node.size
      if (da > 0.003) segments.push({ key: `o${node.id}`, other: node.other, depth, a0: a, a1: a + da })
    }
  }
  walk(root, 1, 0, Math.PI * 2)
  return { segments, maxDepth, parents }
}

function arcPath(cx: number, cy: number, a0: number, a1: number, r0: number, r1: number): string {
  const full = a1 - a0 >= Math.PI * 2 - 1e-4
  if (full) a1 = a0 + Math.PI * 2 - 1e-4
  const p = (a: number, r: number): string => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
}

interface Props {
  tree: TreeNode
  colors: Map<number, Colored>
  hovered: number | null
  canGoUp: boolean
  onHover(id: number | null): void
  onOpen(node: TreeNode): void
  onUp(): void
  onContext(e: React.MouseEvent, node: TreeNode): void
}

export function Sunburst({ tree, colors, hovered: hoveredId, canGoUp, onHover, onOpen, onUp, onContext }: Props) {
  const { t, bytes, num } = useI18n()
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const { segments, maxDepth, parents } = useMemo(() => layout(tree), [tree])

  const size = Math.max(0, Math.min(width, height))
  const c = size / 2
  const outer = c - 8
  const inner = outer * 0.3
  const ring = (outer - inner) / Math.max(maxDepth, 3)

  // Ignore hovers on items that are not drawn (folded into "other").
  const hovered = hoveredId !== null && parents.has(hoveredId) ? hoveredId : null

  // The hovered node plus all its ancestors and descendants stay bright.
  const isLit = (id: number | undefined): boolean => {
    if (hovered === null) return true
    if (id === undefined) return false
    for (let cur: number | undefined = id; cur !== undefined; cur = parents.get(cur)) if (cur === hovered) return true
    for (let cur: number | undefined = parents.get(hovered); cur !== undefined; cur = parents.get(cur)) if (cur === id) return true
    return false
  }

  const focus = hovered !== null ? findNode(tree, hovered) : null
  const shown = focus ?? tree

  return (
    <div className="sunburst" ref={ref} onMouseLeave={() => onHover(null)}>
      {size > 0 && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g key={tree.id} className="sunburst-rings">
            {segments.map((s) => {
              const r0 = inner + (s.depth - 1) * ring + 1
              const r1 = r0 + ring - 1.5
              const pad = Math.min(0.004, (s.a1 - s.a0) * 0.15)
              const color = s.node ? (colors.get(s.node.id)?.color ?? OTHER_COLOR) : OTHER_COLOR
              const lit = s.node ? isLit(s.node.id) : hovered === null
              return (
                <path
                  key={s.key}
                  d={arcPath(c, c, s.a0 + pad, s.a1 - pad, r0, r1)}
                  fill={color}
                  className={`seg${s.node?.isDir ? ' seg-dir' : ''}${lit ? '' : ' seg-dim'}`}
                  onMouseEnter={() => onHover(s.node ? s.node.id : null)}
                  onClick={() => s.node?.isDir && onOpen(s.node)}
                  onContextMenu={(e) => s.node && onContext(e, s.node)}
                />
              )
            })}
          </g>
          <circle
            cx={c}
            cy={c}
            r={inner - 6}
            className={`sunburst-center${canGoUp ? ' can-up' : ''}`}
            onClick={canGoUp ? onUp : undefined}
            onMouseEnter={() => onHover(null)}
          />
        </svg>
      )}
      {size > 0 && (
        <div className="sunburst-label" style={{ width: inner * 1.55 }}>
          <div className="sl-name" title={shown.name}>
            {shown.name}
          </div>
          <div className="sl-size">{bytes(shown.size)}</div>
          {focus ? (
            <div className="sl-sub">
              {pct(focus.size, tree.size)} {t.ofParent}
            </div>
          ) : (
            <div className="sl-sub">
              {num(tree.files)} {t.statFiles.toLowerCase()}
            </div>
          )}
          {!focus && canGoUp && <div className="sl-hint">{t.clickToGoUp}</div>}
        </div>
      )}
    </div>
  )
}

function findNode(root: TreeNode, id: number): TreeNode | null {
  if (root.id === id) return root
  for (const c of root.children ?? []) {
    const f = findNode(c, id)
    if (f) return f
  }
  return null
}
