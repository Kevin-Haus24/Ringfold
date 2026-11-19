import type { TreeNode } from '../../../shared/types'

// Ten well-separated hues; each top-level branch gets one and its
// descendants keep it, so the chart reads as "families" of color.
const HUES = [232, 188, 152, 38, 346, 272, 206, 18, 118, 304]

export const OTHER_COLOR = 'var(--other)'

export function segmentColor(hue: number, depth: number, isDir: boolean): string {
  const sat = isDir ? 78 : 52
  const light = Math.min(56 + depth * 5, 80)
  return `hsl(${hue} ${sat}% ${light}%)`
}

export interface Colored {
  color: string
  hue: number
}

/** id → color for every node in the sunburst tree; the size list reuses it. */
export function buildColorMap(root: TreeNode): Map<number, Colored> {
  const map = new Map<number, Colored>()
  const walk = (node: TreeNode, hue: number, depth: number): void => {
    node.children?.forEach((child, i) => {
      const h = depth === 0 ? HUES[i % HUES.length] : hue + ((i % 5) - 2) * 5
      map.set(child.id, { hue: h, color: segmentColor(h, depth, child.isDir) })
      walk(child, h, depth + 1)
    })
  }
  walk(root, 0, 0)
  return map
}
