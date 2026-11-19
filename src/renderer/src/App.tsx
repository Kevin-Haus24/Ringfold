import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NodeView, ScanResult, ThemeMode, TreeNode } from '../../shared/types'
import { ContextMenu, type MenuState, type MenuTarget } from './components/ContextMenu'
import { Duplicates } from './components/Duplicates'
import { Home } from './components/Home'
import { BigFileIcon, ChartIcon, DupesIcon, PieIcon } from './components/Icons'
import { Scanning } from './components/Scanning'
import { SizeList } from './components/SizeList'
import { Sunburst } from './components/Sunburst'
import { TitleBar } from './components/TitleBar'
import { TopFiles } from './components/TopFiles'
import { TypesView } from './components/TypesView'
import { useI18n } from './i18n'
import { buildColorMap } from './lib/colors'
import { errorMessage, isCancelled, storage } from './lib/util'

type Screen = 'home' | 'scanning' | 'results'
type Tab = 'overview' | 'types' | 'top' | 'dupes'

const SUNBURST_DEPTH = 5
const SUNBURST_MIN_FRACTION = 0.0025

function initialTheme(): ThemeMode {
  const v = storage.get('theme')
  return v === 'dark' || v === 'light' ? v : 'system'
}

export function App() {
  const { t, lang, bytes, num, duration } = useI18n()
  const [screen, setScreen] = useState<Screen>('home')
  const [scanPath, setScanPath] = useState('')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [current, setCurrent] = useState(0)
  const [view, setView] = useState<NodeView | null>(null)
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['overview']))
  const [version, setVersion] = useState(0)
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [hovered, setHovered] = useState<number | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(initialTheme)

  useEffect(() => {
    void window.api.setTheme(theme)
    storage.set('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const startScan = useCallback(async (path: string) => {
    setScanPath(path)
    setScreen('scanning')
    setMenu(null)
    try {
      const result = await window.api.scan(path)
      setScan(result)
      setCurrent(0)
      setTab('overview')
      setVisited(new Set(['overview']))
      setRemoved(new Set())
      setVersion((v) => v + 1)
      setScreen('results')
    } catch (e) {
      if (!isCancelled(e)) setToast({ text: errorMessage(e), kind: 'error' })
      setScreen('home')
    }
  }, [])

  // Load the list and the chart for the current folder.
  useEffect(() => {
    if (screen !== 'results') return
    let alive = true
    Promise.all([window.api.view(current, 400), window.api.tree(current, SUNBURST_DEPTH, SUNBURST_MIN_FRACTION)]).then(
      ([v, tr]) => {
        if (!alive) return
        setView(v)
        setTree(tr)
      },
      (e) => {
        if (!alive) return
        // The node may have been trashed: fall back to the root.
        if (current !== 0) setCurrent(0)
        else setToast({ text: errorMessage(e), kind: 'error' })
      }
    )
    return () => {
      alive = false
    }
  }, [screen, current, version])

  const colors = useMemo(() => (tree ? buildColorMap(tree) : new Map()), [tree])

  const navigate = useCallback((id: number) => {
    setHovered(null)
    setCurrent(id)
  }, [])
  const goUp = useCallback(() => {
    const parent = view?.ancestors.at(-1)
    if (parent) navigate(parent.id)
  }, [view, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (screen !== 'results' || menu) return
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault()
        goUp()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, menu, goUp])

  const openContext = useCallback((e: React.MouseEvent, target: MenuTarget) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, target: { id: target.id, name: target.name, isDir: target.isDir } })
  }, [])

  const trash = useCallback(
    async (target: MenuTarget) => {
      const r = await window.api.trash(target.id, lang).catch((e) => ({ ok: false, error: errorMessage(e) }))
      if (r.ok) {
        setRemoved((s) => new Set(s).add(target.id))
        setVersion((v) => v + 1)
        setToast({ text: t.trashed(bytes(('freed' in r && r.freed) || 0)), kind: 'ok' })
      } else if ('error' in r && r.error) {
        setToast({ text: t.trashFailed(r.error), kind: 'error' })
      }
    },
    [lang, t, bytes]
  )

  const selectTab = (next: Tab): void => {
    setTab(next)
    setVisited((v) => new Set(v).add(next))
  }

  const cycleTheme = (): void => setTheme((m) => (m === 'system' ? 'dark' : m === 'dark' ? 'light' : 'system'))

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t.tabOverview, icon: <ChartIcon size={16} /> },
    { id: 'types', label: t.tabTypes, icon: <PieIcon size={16} /> },
    { id: 'top', label: t.tabTop, icon: <BigFileIcon size={16} /> },
    { id: 'dupes', label: t.tabDupes, icon: <DupesIcon size={16} /> }
  ]

  const results = screen === 'results'
  return (
    <div className="app">
      <TitleBar
        view={results ? view : null}
        theme={theme}
        onTheme={cycleTheme}
        onNavigate={navigate}
        onRescan={results ? () => startScan(scanPath) : undefined}
        onHome={results ? () => setScreen('home') : undefined}
      />

      {screen === 'home' && <Home onScan={startScan} />}
      {screen === 'scanning' && <Scanning path={scanPath} onCancel={() => window.api.cancel()} />}

      {results && view && (
        <div className="results">
          <div className="toolbar">
            <div className="tabs" role="tablist">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={tab === x.id}
                  className={`tab${tab === x.id ? ' active' : ''}`}
                  onClick={() => selectTab(x.id)}
                >
                  {x.icon}
                  {x.label}
                </button>
              ))}
            </div>
            <div className="stats">
              <span>
                <strong>{bytes(view.node.size)}</strong>
              </span>
              <span>
                {num(view.node.files)} {t.statFiles.toLowerCase()}
              </span>
              <span>
                {num(view.node.dirs)} {t.statDirs.toLowerCase()}
              </span>
              {scan && (
                <span className="hide-narrow">
                  {t.statScanned} {duration(scan.elapsedMs)}
                </span>
              )}
            </div>
          </div>

          <main className="content">
            {tab === 'overview' && tree && (
              <div className="overview">
                <section className="card chart-card">
                  <Sunburst
                    tree={tree}
                    colors={colors}
                    hovered={hovered}
                    canGoUp={view.ancestors.length > 0}
                    onHover={setHovered}
                    onOpen={(n) => navigate(n.id)}
                    onUp={goUp}
                    onContext={openContext}
                  />
                </section>
                <section className="card list-card">
                  <SizeList
                    view={view}
                    colors={colors}
                    hovered={hovered}
                    onHover={setHovered}
                    onOpen={(n) => (n.isDir ? navigate(n.id) : void window.api.open(n.id))}
                    onContext={openContext}
                  />
                </section>
              </div>
            )}
            {tab === 'types' && (
              <section className="card scroll-card">
                <TypesView node={current} version={version} />
              </section>
            )}
            {tab === 'top' && (
              <section className="card scroll-card">
                <TopFiles node={current} version={version} onContext={openContext} />
              </section>
            )}
            {/* Kept mounted so results survive switching tabs. */}
            {visited.has('dupes') && (
              <section className="card scroll-card" hidden={tab !== 'dupes'}>
                <Duplicates node={current} removed={removed} onTrash={trash} onContext={openContext} />
              </section>
            )}
          </main>
        </div>
      )}

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onBrowse={results && tab === 'overview' ? (x) => navigate(x.id) : undefined}
          onTrash={trash}
          onCopied={() => setToast({ text: t.copied, kind: 'ok' })}
        />
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}
