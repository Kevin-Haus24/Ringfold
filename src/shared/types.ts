// Types shared by the main process, the preload bridge and the renderer.

export type Lang = 'ru' | 'en'
export type ThemeMode = 'system' | 'dark' | 'light'

export interface NodeSummary {
  id: number
  name: string
  size: number
  files: number
  dirs: number
  /** Unix seconds; for folders, the newest file inside. */
  mtime: number
  isDir: boolean
  childCount: number
}

export interface TreeNode extends NodeSummary {
  children?: TreeNode[]
  /** Children too small to draw, folded together. */
  other?: { count: number; size: number }
}

export interface NodeView {
  node: NodeSummary
  path: string
  ancestors: { id: number; name: string }[]
  children: NodeSummary[]
  more: { count: number; size: number }
}

export interface ScanProgress {
  files: number
  dirs: number
  bytes: number
  errors: number
  current: string
  elapsedMs: number
}

export interface ScanResult {
  root: NodeSummary
  errors: number
  elapsedMs: number
}

export interface FileEntry extends NodeSummary {
  path: string
}

export interface ExtStat {
  ext: string
  size: number
  count: number
}

export interface DupeFile {
  id: number
  path: string
  name: string
}

export interface DupeGroup {
  size: number
  wasted: number
  files: DupeFile[]
}

export interface DupesResult {
  groups: DupeGroup[]
  totalGroups: number
  wasted: number
}

export interface DupesProgress {
  /** 1 = quick pass over the first 64 KB, 2 = full comparison */
  stage: number
  doneFiles: number
  totalFiles: number
  doneBytes: number
  totalBytes: number
}

export interface Volume {
  path: string
  label: string
  total: number
  free: number
  kind: 'drive' | 'home'
}

export interface TrashResult {
  ok: boolean
  cancelled?: boolean
  freed?: number
  error?: string
}

export interface RingfoldApi {
  platform: string
  volumes(): Promise<Volume[]>
  pickFolder(): Promise<string | null>
  scan(path: string): Promise<ScanResult>
  cancel(): Promise<void>
  view(node: number, limit?: number): Promise<NodeView>
  tree(node: number, depth: number, minFraction: number): Promise<TreeNode>
  top(node: number, limit: number): Promise<{ files: FileEntry[] }>
  types(node: number): Promise<{ extensions: ExtStat[] }>
  duplicates(node: number, minSize: number): Promise<DupesResult>
  reveal(node: number): Promise<void>
  open(node: number): Promise<void>
  copyPath(node: number): Promise<void>
  trash(node: number, lang: Lang): Promise<TrashResult>
  setTheme(mode: ThemeMode): Promise<void>
  onScanProgress(cb: (p: ScanProgress) => void): () => void
  onDupesProgress(cb: (p: DupesProgress) => void): () => void
}
