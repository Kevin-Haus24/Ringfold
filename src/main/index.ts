import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { join, resolve } from 'node:path'
import { Engine } from './engine'
import { listVolumes } from './volumes'
import { formatBytes } from '../shared/format'
import type { Lang, NodeSummary, ThemeMode } from '../shared/types'

const exe = process.platform === 'win32' ? 'ringfold-engine.exe' : 'ringfold-engine'
const engineBinary = app.isPackaged
  ? join(process.resourcesPath, 'engine', exe)
  : join(app.getAppPath(), 'resources', 'engine', exe)
const engine = new Engine(engineBinary)

let win: BrowserWindow | null = null

const HEADER = { dark: '#0f1218', light: '#f4f5f9' }
function overlayColors(): Electron.TitleBarOverlayOptions {
  const dark = nativeTheme.shouldUseDarkColors
  return { color: dark ? HEADER.dark : HEADER.light, symbolColor: dark ? '#c4cad8' : '#3b4252', height: 48 }
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'Ringfold',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0d12' : '#f4f5f9',
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 18, y: 16 } } : { titleBarOverlay: overlayColors() }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Reloads are fine; navigating away from the app is not.
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

nativeTheme.on('updated', () => {
  if (win && process.platform !== 'darwin') win.setTitleBarOverlay(overlayColors())
})

engine.on('event', (msg: { event: string }) => {
  win?.webContents.send('engine-event', msg)
})

const nodeId = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error('invalid node id')
  return v
}
const pathOf = (node: unknown): Promise<string> => engine.request<string>('path', { node: nodeId(node) })

const TRASH_TEXT: Record<Lang, { title: string; message: (n: string) => string; size: string; ok: string; cancel: string }> = {
  ru: {
    title: 'Переместить в корзину?',
    message: (n) => `«${n}» будет перемещён в корзину.`,
    size: 'Размер',
    ok: 'В корзину',
    cancel: 'Отмена'
  },
  en: {
    title: 'Move to trash?',
    message: (n) => `“${n}” will be moved to the trash.`,
    size: 'Size',
    ok: 'Move to Trash',
    cancel: 'Cancel'
  }
}

function registerIpc(): void {
  ipcMain.handle('volumes', () => listVolumes())
  ipcMain.handle('pick-folder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('scan', (_e, path: unknown) => {
    if (typeof path !== 'string' || !path) throw new Error('invalid path')
    return engine.request('scan', { path: resolve(path) })
  })
  ipcMain.handle('cancel', () => engine.request('cancel'))
  ipcMain.handle('view', (_e, node, limit) => engine.request('view', { node: nodeId(node), limit: Number(limit) || 400 }))
  ipcMain.handle('tree', (_e, node, depth, minFraction) =>
    engine.request('tree', { node: nodeId(node), depth: Number(depth) || 5, minFraction: Number(minFraction) || 0.002 })
  )
  ipcMain.handle('top', (_e, node, limit) => engine.request('top', { node: nodeId(node), limit: Number(limit) || 100 }))
  ipcMain.handle('types', (_e, node) => engine.request('types', { node: nodeId(node) }))
  ipcMain.handle('duplicates', (_e, node, minSize) =>
    engine.request('duplicates', { node: nodeId(node), minSize: Number(minSize) || 1 << 20 })
  )
  ipcMain.handle('reveal', async (_e, node) => shell.showItemInFolder(await pathOf(node)))
  ipcMain.handle('open', async (_e, node) => {
    const err = await shell.openPath(await pathOf(node))
    if (err) throw new Error(err)
  })
  ipcMain.handle('copy-path', async (_e, node) => clipboard.writeText(await pathOf(node)))
  ipcMain.handle('set-theme', (_e, mode: ThemeMode) => {
    nativeTheme.themeSource = mode === 'dark' || mode === 'light' ? mode : 'system'
  })

  // Deleting always goes through the system trash and a native confirmation.
  ipcMain.handle('trash', async (_e, node, lang: Lang) => {
    const id = nodeId(node)
    const text = TRASH_TEXT[lang === 'ru' ? 'ru' : 'en']
    const path = await pathOf(id)
    const view = await engine.request<{ node: NodeSummary }>('view', { node: id, limit: 0 })
    const { response } = await dialog.showMessageBox(win!, {
      type: 'warning',
      title: text.title,
      message: text.message(view.node.name),
      detail: `${path}\n${text.size}: ${formatBytes(view.node.size, lang)}`,
      buttons: [text.ok, text.cancel],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (response !== 0) return { ok: false, cancelled: true }
    try {
      await shell.trashItem(path)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
    const { freed } = await engine.request<{ freed: number }>('remove', { node: id })
    return { ok: true, freed }
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => engine.dispose())
