// Generates the hand-drawn architecture diagram used in the READMEs.
//   npm run docs:diagrams
// Shapes come from rough.js (the library behind Excalidraw's sketchy look);
// text uses the Caveat font (SIL OFL 1.1, see OFL.txt), embedded as a subset.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import rough from 'roughjs'
import subsetFont from 'subset-font'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..')
const W = 880
const H = 640

const TEXT = {
  en: {
    groups: ['Electron app', 'ringfold-engine · Rust', 'Operating system'],
    renderer: ['Renderer', 'React UI · charts'],
    preload: ['Preload', 'contextBridge'],
    main: ['Main process', 'dialogs · IPC'],
    walker: ['Parallel walker', 'rayon threads'],
    tree: ['In-memory tree', 'flat arena'],
    queries: ['Queries', 'view · tree · top · types'],
    dupes: ['Duplicates', 'size → head → full hash'],
    fs: ['File system', 'drives & folders'],
    trash: ['Trash', 'Explorer · Finder'],
    calls: 'calls',
    ipc: 'IPC',
    json: ['JSON lines', 'stdin / stdout'],
    reads: 'reads',
    toTrash: 'confirm → trash'
  },
  ru: {
    groups: ['Приложение Electron', 'ringfold-engine · Rust', 'Операционная система'],
    renderer: ['Renderer', 'интерфейс на React'],
    preload: ['Preload', 'мост contextBridge'],
    main: ['Main-процесс', 'диалоги · IPC'],
    walker: ['Параллельный обход', 'потоки rayon'],
    tree: ['Дерево в памяти', 'плоский массив'],
    queries: ['Запросы', 'view · tree · top · types'],
    dupes: ['Дубликаты', 'размер → начало → хеш'],
    fs: ['Файловая система', 'диски и папки'],
    trash: ['Корзина', 'Проводник · Finder'],
    calls: 'вызовы',
    ipc: 'IPC',
    json: ['JSON-строки', 'stdin / stdout'],
    reads: 'чтение',
    toTrash: 'подтвердить → в корзину'
  }
}

const THEMES = {
  light: { text: '#1f2328', muted: '#59636e', line: '#57606a', app: '#5b6bff', engine: '#0f9e8e', os: '#e5486b' },
  dark: { text: '#e6edf3', muted: '#9aa3ad', line: '#9aa3ad', app: '#8b97ff', engine: '#4fd1c5', os: '#ff6b8b' }
}

// Layout: three columns inside three stacked groups, plus a corridor on the right.
const COL = [
  { x: 40, w: 200 },
  { x: 315, w: 200 },
  { x: 590, w: 205 }
]
const cx = (i) => COL[i].x + COL[i].w / 2

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function roundRect(x, y, w, h, r) {
  return `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`
}

function build(lang, themeName) {
  const t = TEXT[lang]
  const c = THEMES[themeName]
  const gen = rough.generator()
  let seed = 11
  const parts = []

  const draw = (drawable, extra = '') => {
    for (const p of gen.toPaths(drawable)) {
      // One decimal is plenty at this scale and halves the file size.
      const d = p.d.replace(/(\d+\.\d)\d+/g, '$1')
      parts.push(
        `<path d="${d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? 'none'}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
      )
    }
  }
  const text = (x, y, s, { size = 22, color = c.text, weight = 600, anchor = 'middle', rotate = 0 } = {}) => {
    const tr = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ''
    parts.push(
      `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${tr}>${esc(s)}</text>`
    )
  }

  const group = (y, h, color, title, align = 'start') => {
    draw(gen.path(roundRect(20, y, 795, h, 18), { stroke: color, strokeWidth: 1.6, roughness: 1.1, seed: seed++ }))
    text(align === 'start' ? 40 : 795, y + 30, title, { size: 25, color, weight: 700, anchor: align })
  }
  const node = (col, y, h, color, [title, sub]) => {
    const { x, w } = COL[col]
    draw(
      gen.path(roundRect(x, y, w, h, 12), {
        stroke: color,
        strokeWidth: 2,
        roughness: 1.2,
        fill: color,
        fillStyle: 'hachure',
        hachureGap: 7,
        hachureAngle: -41,
        fillWeight: 0.6,
        seed: seed++
      }),
      ''
    )
    // Wash the hachure down so the text stays readable.
    parts.push(`<path d="${roundRect(x + 3, y + 3, w - 6, h - 6, 10)}" fill="${themeName === 'dark' ? '#0d1117' : '#ffffff'}" opacity="0.72"/>`)
    const mid = y + h / 2
    text(x + w / 2, mid - 2, title, { size: 25, weight: 700 })
    text(x + w / 2, mid + 22, sub, { size: 19, color: c.muted, weight: 500 })
  }
  const arrow = (pts, { dashed = false, both = false, color = c.line } = {}) => {
    const opts = { stroke: color, strokeWidth: 1.8, roughness: 0.9, bowing: 1.5, seed: seed++ }
    const dash = dashed ? ' stroke-dasharray="7 7"' : ''
    draw(gen.linearPath(pts, opts), dash)
    const head = (tip, from) => {
      const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0])
      for (const da of [0.45, -0.45]) {
        const back = [tip[0] - 14 * Math.cos(ang + da), tip[1] - 14 * Math.sin(ang + da)]
        draw(gen.line(back[0], back[1], tip[0], tip[1], { ...opts, seed: seed++ }))
      }
    }
    head(pts[pts.length - 1], pts[pts.length - 2])
    if (both) head(pts[0], pts[1])
  }

  // 1. Electron app
  group(20, 170, c.app, t.groups[0])
  node(0, 72, 98, c.app, t.renderer)
  node(1, 72, 98, c.app, t.preload)
  node(2, 72, 98, c.app, t.main)
  arrow([[COL[0].x + COL[0].w + 8, 121], [COL[1].x - 8, 121]], { both: true })
  text((COL[0].x + COL[0].w + COL[1].x) / 2, 108, t.calls, { size: 19, color: c.muted, weight: 500 })
  arrow([[COL[1].x + COL[1].w + 8, 121], [COL[2].x - 8, 121]], { both: true })
  text((COL[1].x + COL[1].w + COL[2].x) / 2, 108, t.ipc, { size: 19, color: c.muted, weight: 500 })

  // Main ⇄ engine
  arrow([[cx(2), 178], [cx(2), 262]], { both: true, color: c.engine })
  text(cx(2) - 16, 214, t.json[0], { size: 21, color: c.text, anchor: 'end' })
  text(cx(2) - 16, 236, t.json[1], { size: 19, color: c.muted, weight: 500, anchor: 'end' })

  // 2. Engine
  group(250, 210, c.engine, t.groups[1])
  node(0, 305, 120, c.engine, t.walker)
  node(1, 305, 120, c.engine, t.tree)
  node(2, 296, 72, c.engine, t.queries)
  node(2, 378, 72, c.engine, t.dupes)
  arrow([[COL[0].x + COL[0].w + 8, 365], [COL[1].x - 8, 365]])
  arrow([[COL[1].x + COL[1].w + 8, 350], [COL[2].x - 8, 334]])
  arrow([[COL[1].x + COL[1].w + 8, 380], [COL[2].x - 8, 410]])

  // 3. Operating system
  // Title on the right so the "reads" arrows do not cross it.
  group(505, 120, c.os, t.groups[2], 'end')
  const fs = { x: COL[0].x, w: COL[1].x + COL[1].w - COL[0].x }
  draw(
    gen.path(roundRect(fs.x, 548, fs.w, 64, 12), {
      stroke: c.os, strokeWidth: 2, roughness: 1.2, fill: c.os, fillStyle: 'hachure', hachureGap: 7, fillWeight: 0.6, seed: seed++
    })
  )
  parts.push(`<path d="${roundRect(fs.x + 3, 551, fs.w - 6, 58, 10)}" fill="${themeName === 'dark' ? '#0d1117' : '#ffffff'}" opacity="0.72"/>`)
  text(fs.x + fs.w / 2, 578, t.fs[0], { size: 25, weight: 700 })
  text(fs.x + fs.w / 2, 600, t.fs[1], { size: 19, color: c.muted, weight: 500 })
  node(2, 548, 64, c.os, t.trash)

  arrow([[cx(0), 432], [cx(0), 541]], { dashed: true })
  text(cx(0) + 12, 488, t.reads, { size: 19, color: c.muted, weight: 500, anchor: 'start' })
  arrow([[COL[2].x + 30, 457], [COL[1].x + COL[1].w - 40, 541]], { dashed: true })
  text(COL[2].x + 8, 500, t.reads, { size: 19, color: c.muted, weight: 500, anchor: 'start' })

  // Main → trash, around the right edge.
  arrow([[COL[2].x + COL[2].w + 6, 100], [850, 100], [850, 580], [COL[2].x + COL[2].w + 8, 580]], { color: c.os })
  text(866, 340, t.toTrash, { size: 19, color: c.os, weight: 600, rotate: 90 })

  return parts
}

const fontBuffer = readFileSync(join(here, 'Caveat.ttf'))
const allText = JSON.stringify(TEXT)
const font = await subsetFont(fontBuffer, allText, { targetFormat: 'woff2', variationAxes: { wght: 600 } }).catch(() =>
  subsetFont(fontBuffer, allText, { targetFormat: 'woff2' })
)
const fontCss = `@font-face{font-family:Caveat;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');}text{font-family:Caveat,'Segoe Print','Comic Sans MS',cursive;}`

for (const lang of ['en', 'ru']) {
  for (const theme of ['light', 'dark']) {
    const body = build(lang, theme).join('\n')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Ringfold architecture">
<!-- Generated by docs/diagrams/architecture.mjs. Font: Caveat, © The Caveat Project Authors, SIL Open Font License 1.1. -->
<style>${fontCss}</style>
${body}
</svg>
`
    const file = join(outDir, `architecture-${lang}-${theme}.svg`)
    writeFileSync(file, svg)
    console.log(`${file} (${(svg.length / 1024).toFixed(0)} KB)`)
  }
}
