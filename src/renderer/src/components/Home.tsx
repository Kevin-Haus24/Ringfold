import { useEffect, useState } from 'react'
import type { Volume } from '../../../shared/types'
import { useI18n } from '../i18n'
import { DriveIcon, FolderSearchIcon, HomeIcon } from './Icons'

export function Home({ onScan }: { onScan(path: string): void }) {
  const { t, bytes } = useI18n()
  const [volumes, setVolumes] = useState<Volume[] | null>(null)

  useEffect(() => {
    window.api.volumes().then(setVolumes, () => setVolumes([]))
  }, [])

  const pick = async (): Promise<void> => {
    const path = await window.api.pickFolder()
    if (path) onScan(path)
  }

  return (
    <div className="home-screen">
      <div className="home-hero">
        <h1>{t.homeTitle}</h1>
        <p>{t.homeSubtitle}</p>
      </div>
      <div className="volume-grid">
        {volumes === null && [0, 1, 2].map((i) => <div key={i} className="volume-card skeleton" />)}
        {volumes?.map((v) => {
          const used = v.total - v.free
          const ratio = v.total > 0 ? used / v.total : 0
          const level = ratio > 0.9 ? 'crit' : ratio > 0.75 ? 'warn' : 'ok'
          return (
            <button key={v.path} className="volume-card" onClick={() => onScan(v.path)}>
              <div className="vc-top">
                <span className={`vc-icon ${v.kind}`}>{v.kind === 'home' ? <HomeIcon size={20} /> : <DriveIcon size={20} />}</span>
                <span className="vc-title">
                  <strong>{v.kind === 'home' ? t.home : v.label}</strong>
                  <small title={v.path}>{v.path}</small>
                </span>
                <span className="vc-pct">{Math.round(ratio * 100)}%</span>
              </div>
              <div className={`meter ${level}`}>
                <span style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="vc-foot">{t.freeOf(bytes(v.free), bytes(v.total))}</div>
            </button>
          )
        })}
        <button className="volume-card pick" onClick={pick}>
          <span className="vc-icon pick">
            <FolderSearchIcon size={22} />
          </span>
          <strong>{t.chooseFolder}</strong>
          <small>{t.chooseFolderHint}</small>
        </button>
      </div>
    </div>
  )
}
