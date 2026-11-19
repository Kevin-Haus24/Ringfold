import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DupesProgress, RingfoldApi, ScanProgress } from '../shared/types'

function onEngineEvent<T>(name: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, msg: { event: string } & T): void => {
    if (msg.event === name) cb(msg)
  }
  ipcRenderer.on('engine-event', handler)
  return () => ipcRenderer.removeListener('engine-event', handler)
}

const api: RingfoldApi = {
  platform: process.platform,
  volumes: () => ipcRenderer.invoke('volumes'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  scan: (path) => ipcRenderer.invoke('scan', path),
  cancel: () => ipcRenderer.invoke('cancel'),
  view: (node, limit) => ipcRenderer.invoke('view', node, limit),
  tree: (node, depth, minFraction) => ipcRenderer.invoke('tree', node, depth, minFraction),
  top: (node, limit) => ipcRenderer.invoke('top', node, limit),
  types: (node) => ipcRenderer.invoke('types', node),
  duplicates: (node, minSize) => ipcRenderer.invoke('duplicates', node, minSize),
  reveal: (node) => ipcRenderer.invoke('reveal', node),
  open: (node) => ipcRenderer.invoke('open', node),
  copyPath: (node) => ipcRenderer.invoke('copy-path', node),
  trash: (node, lang) => ipcRenderer.invoke('trash', node, lang),
  setTheme: (mode) => ipcRenderer.invoke('set-theme', mode),
  onScanProgress: (cb) => onEngineEvent<ScanProgress>('scan-progress', cb),
  onDupesProgress: (cb) => onEngineEvent<DupesProgress>('dupes-progress', cb)
}

contextBridge.exposeInMainWorld('api', api)
