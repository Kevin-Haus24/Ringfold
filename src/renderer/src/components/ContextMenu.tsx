import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { CopyIcon, FolderIcon, OpenIcon, RevealIcon, TrashIcon } from './Icons'

export interface MenuTarget {
  id: number
  name: string
  isDir: boolean
}

export interface MenuState {
  x: number
  y: number
  target: MenuTarget
}

interface Props {
  menu: MenuState
  onClose(): void
  onBrowse?(target: MenuTarget): void
  onTrash(target: MenuTarget): void
  onCopied(): void
}

export function ContextMenu({ menu, onClose, onBrowse, onTrash, onCopied }: Props) {
  const { t, fileManager } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.min(menu.x, window.innerWidth - width - 8),
      top: Math.min(menu.y, window.innerHeight - height - 8)
    })
  }, [menu])

  useEffect(() => {
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [onClose])

  const { target } = menu
  const act = (fn: () => void) => () => {
    onClose()
    fn()
  }

  return (
    <div className="context-menu" ref={ref} style={pos} role="menu">
      <div className="cm-title" title={target.name}>
        {target.name}
      </div>
      {target.isDir && onBrowse && (
        <button role="menuitem" onClick={act(() => onBrowse(target))}>
          <FolderIcon size={16} /> {t.actBrowse}
        </button>
      )}
      <button role="menuitem" onClick={act(() => void window.api.open(target.id))}>
        <OpenIcon size={16} /> {t.actOpen}
      </button>
      <button role="menuitem" onClick={act(() => void window.api.reveal(target.id))}>
        <RevealIcon size={16} /> {t.actReveal(fileManager)}
      </button>
      <button role="menuitem" onClick={act(() => void window.api.copyPath(target.id).then(onCopied))}>
        <CopyIcon size={16} /> {t.actCopy}
      </button>
      <div className="cm-sep" />
      <button role="menuitem" className="danger" onClick={act(() => onTrash(target))}>
        <TrashIcon size={16} /> {t.actTrash}
      </button>
    </div>
  )
}
