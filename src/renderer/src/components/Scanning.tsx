import { useEffect, useState } from 'react'
import type { ScanProgress } from '../../../shared/types'
import { useI18n } from '../i18n'

export function Scanning({ path, onCancel }: { path: string; onCancel(): void }) {
  const { t, bytes, num, duration } = useI18n()
  const [p, setP] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.onScanProgress(setP), [])

  return (
    <div className="scanning">
      <div className="radar">
        <div className="radar-sweep" />
        <div className="radar-ring r1" />
        <div className="radar-ring r2" />
        <div className="radar-core">{bytes(p?.bytes ?? 0)}</div>
      </div>
      <h2>
        {t.scanning} <span className="path">{path}</span>
      </h2>
      <div className="scan-stats">
        <div>
          <strong>{num(p?.files ?? 0)}</strong>
          <span>{t.scanFiles}</span>
        </div>
        <div>
          <strong>{num(p?.dirs ?? 0)}</strong>
          <span>{t.scanDirs}</span>
        </div>
        <div>
          <strong>{duration(p?.elapsedMs ?? 0)}</strong>
          <span>{t.scanTime}</span>
        </div>
      </div>
      <div className="scan-current" title={p?.current}>
        {p?.current || '…'}
      </div>
      {!!p?.errors && <div className="scan-errors">{t.scanErrors(num(p.errors))}</div>}
      <button className="btn" onClick={onCancel}>
        {t.cancel}
      </button>
    </div>
  )
}
