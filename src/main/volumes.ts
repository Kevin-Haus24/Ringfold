import { readdir, readFile, realpath, statfs } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { Volume } from '../shared/types'

async function space(path: string): Promise<{ total: number; free: number } | null> {
  try {
    // Unresponsive network drives must not block the home screen.
    const s = await Promise.race([
      statfs(path),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ])
    const total = s.blocks * s.bsize
    return total > 0 ? { total, free: s.bavail * s.bsize } : null
  } catch {
    return null
  }
}

async function windowsDrives(): Promise<Volume[]> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const found = await Promise.all(
    letters.map(async (l): Promise<Volume | null> => {
      const path = `${l}:\\`
      const s = await space(path)
      return s ? { path, label: `${l}:`, kind: 'drive', ...s } : null
    })
  )
  return found.filter((v): v is Volume => v !== null)
}

async function macVolumes(): Promise<Volume[]> {
  const out: Volume[] = []
  const root = await space('/')
  if (root) out.push({ path: '/', label: 'Macintosh HD', kind: 'drive', ...root })
  try {
    for (const name of await readdir('/Volumes')) {
      const path = join('/Volumes', name)
      if ((await realpath(path).catch(() => path)) === '/') continue // alias of the boot disk
      const s = await space(path)
      if (s) out.push({ path, label: name, kind: 'drive', ...s })
    }
  } catch {
    /* no /Volumes */
  }
  return out
}

const REAL_FS = new Set([
  'ext2', 'ext3', 'ext4', 'btrfs', 'xfs', 'zfs', 'f2fs', 'jfs', 'reiserfs', 'bcachefs',
  'vfat', 'exfat', 'ntfs', 'ntfs3', 'fuseblk', 'hfsplus', 'apfs'
])

async function linuxVolumes(): Promise<Volume[]> {
  let mounts: string
  try {
    mounts = await readFile('/proc/mounts', 'utf8')
  } catch {
    const s = await space('/')
    return s ? [{ path: '/', label: '/', kind: 'drive', ...s }] : []
  }
  // One entry per device, keeping the shortest mount point (btrfs subvolumes share a device).
  const byDevice = new Map<string, string>()
  for (const line of mounts.split('\n')) {
    const [device, rawMount, fstype] = line.split(' ')
    if (!device || !rawMount || !REAL_FS.has(fstype)) continue
    const mount = rawMount.replace(/\\040/g, ' ')
    if (mount.startsWith('/boot') || mount.startsWith('/snap') || mount.startsWith('/var/lib')) continue
    const prev = byDevice.get(device)
    if (!prev || mount.length < prev.length) byDevice.set(device, mount)
  }
  const out: Volume[] = []
  for (const mount of [...byDevice.values()].sort()) {
    const s = await space(mount)
    if (s) out.push({ path: mount, label: mount === '/' ? '/' : basename(mount), kind: 'drive', ...s })
  }
  return out
}

export async function listVolumes(): Promise<Volume[]> {
  const drives =
    process.platform === 'win32'
      ? await windowsDrives()
      : process.platform === 'darwin'
        ? await macVolumes()
        : await linuxVolumes()
  const home = homedir()
  const homeSpace = await space(home)
  if (homeSpace) drives.push({ path: home, label: basename(home), kind: 'home', ...homeSpace })
  return drives
}
