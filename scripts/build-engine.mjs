// Builds the Rust engine in release mode and copies the binary to
// resources/engine/, where both `electron-vite dev` and electron-builder
// pick it up.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const exe = process.platform === 'win32' ? 'ringfold-engine.exe' : 'ringfold-engine'
const target = process.env.RINGFOLD_TARGET // e.g. aarch64-apple-darwin in CI

// rustup puts cargo in ~/.cargo/bin; a fresh shell may not have it on PATH yet.
const env = { ...process.env, PATH: [join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) }
const args = ['build', '--release', '--manifest-path', join(root, 'engine', 'Cargo.toml')]
if (target) args.push('--target', target)

const result = spawnSync('cargo', args, { stdio: 'inherit', env })
if (result.error || result.status !== 0) {
  console.error('\nEngine build failed. Install Rust from https://rustup.rs and try again.')
  process.exit(result.status ?? 1)
}

const built = join(root, 'engine', 'target', ...(target ? [target] : []), 'release', exe)
if (!existsSync(built)) {
  console.error(`Engine binary not found at ${built}`)
  process.exit(1)
}
const outDir = join(root, 'resources', 'engine')
mkdirSync(outDir, { recursive: true })
copyFileSync(built, join(outDir, exe))
console.log(`engine -> ${join('resources', 'engine', exe)}`)
