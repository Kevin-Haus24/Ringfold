import type { NodeView, ThemeMode } from '../../../shared/types'
import { useI18n } from '../i18n'
import { BackIcon, ChevronIcon, HomeIcon, Logo, MoonIcon, RefreshIcon, SunIcon, SystemIcon } from './Icons'

interface Props {
  view: NodeView | null
  theme: ThemeMode
  onTheme(): void
  onNavigate(id: number): void
  onRescan?(): void
  onHome?(): void
}

export function TitleBar({ view, theme, onTheme, onNavigate, onRescan, onHome }: Props) {
  const { t, lang, setLang } = useI18n()
  const crumbs = view ? [...view.ancestors, { id: view.node.id, name: view.node.name }] : []
  // Long paths: keep the root and the last three levels.
  const visible = crumbs.length > 5 ? [crumbs[0], null, ...crumbs.slice(-3)] : crumbs
  const parent = view?.ancestors.at(-1)

  const themeLabel = theme === 'system' ? t.themeSystem : theme === 'dark' ? t.themeDark : t.themeLight

  return (
    <header className="titlebar">
      <div className="brand">
        <Logo />
        <span>Ringfold</span>
      </div>
      {view && (
        <nav className="crumbs">
          <button className="icon-btn" disabled={!parent} title={t.up} onClick={() => parent && onNavigate(parent.id)}>
            <BackIcon size={16} />
          </button>
          {visible.map((c, i) =>
            c === null ? (
              <span key="gap" className="crumb-gap">
                …
              </span>
            ) : (
              <span key={c.id} className="crumb-wrap">
                {i > 0 && <ChevronIcon size={14} className="crumb-sep" />}
                <button
                  className={`crumb${c.id === view.node.id ? ' current' : ''}`}
                  onClick={() => onNavigate(c.id)}
                  title={c.name}
                >
                  {c.name}
                </button>
              </span>
            )
          )}
        </nav>
      )}
      <div className="drag-space" />
      <div className="actions">
        {onRescan && (
          <button className="icon-btn" title={t.rescan} onClick={onRescan}>
            <RefreshIcon size={17} />
          </button>
        )}
        {onHome && (
          <button className="icon-btn" title={t.newScan} onClick={onHome}>
            <HomeIcon size={17} />
          </button>
        )}
        <button
          className="icon-btn lang"
          title={t.language}
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
        >
          {lang.toUpperCase()}
        </button>
        <button className="icon-btn" title={`${t.theme}: ${themeLabel}`} onClick={onTheme}>
          {theme === 'system' ? <SystemIcon size={17} /> : theme === 'dark' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
        </button>
      </div>
    </header>
  )
}
