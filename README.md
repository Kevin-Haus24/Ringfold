<p align="center">
  <img src="build/icon.png" width="96" alt="Ringfold logo" />
</p>

<h1 align="center">Ringfold</h1>

<p align="center">
  <i>See where your disk space went, ring by ring.</i><br/><br/>
  A fast, good-looking disk space analyzer for Windows, macOS and Linux.<br/>
  See at a glance <b>where</b> your space went and <b>how much</b> each folder takes.
</p>

<p align="center">
  <b>English</b> · <a href="README.ru.md">Русский</a>
</p>

---

## Features

- **Sunburst chart** — rings are nesting levels, slice size is disk usage. Hover to highlight a branch, click to zoom in, click the center to go up.
- **Size list** — every folder's children sorted by size, with bars, share and item counts. Colors match the chart.
- **File types** — space grouped into categories (video, images, archives, code, game data, …) with a per-extension breakdown.
- **Largest files** — the top 200 files anywhere under the current folder.
- **Duplicates** — finds identical files by content (size → quick hash → full hash), shows how much can be freed.
- **Safe actions** — open, show in Explorer/Finder, copy path, move to **trash** (always with a confirmation; nothing is deleted permanently).
- **Fast** — the scanner is a native Rust engine that walks directories in parallel (≈1.9 M files in ~40 s on a regular SSD).
- Russian and English UI, dark and light themes.

## Download

Grab an installer for your platform from the [Releases](../../releases) page:

| Platform | File |
| --- | --- |
| Windows | `Ringfold-x.y.z-setup.exe` or the portable `.exe` |
| macOS (Apple Silicon / Intel) | `Ringfold-x.y.z-mac-arm64.dmg` / `-mac-x64.dmg` |
| Linux | `.AppImage` or `.deb` |

> **Builds are not code-signed by Apple or Microsoft yet**, so the system asks for confirmation the first time:
>
> - **Windows:** SmartScreen says *“Windows protected your PC”* → **More info** → **Run anyway**.
> - **macOS:** open Ringfold once (it will be blocked), then go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.
>   If macOS says the app *“is damaged”* (version 0.1.0), run this once in Terminal and open it again:
>   ```bash
>   xattr -cr /Applications/Ringfold.app
>   ```

## Build from source

Requirements: [Node.js](https://nodejs.org) 22+ and [Rust](https://rustup.rs) (stable).

```bash
git clone https://github.com/Kevin-Haus24/Ringfold.git
cd Ringfold
npm install
npm run dev        # builds the engine and starts the app with hot reload
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Engine + production bundles in `out/` |
| `npm run dist` | Installer for the current OS in `dist/` |
| `npm run typecheck` | TypeScript checks |
| `npm run engine:test` | Rust unit tests |

## How it works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-en-dark.svg">
    <img src="docs/architecture-en-light.svg" alt="Ringfold architecture: Electron app, Rust engine, operating system" width="100%">
  </picture>
</p>

- The engine keeps the scanned tree in memory and answers small queries, so the UI never has to receive millions of entries.
- The renderer is sandboxed with context isolation; deletion goes only through the main process, the system trash and a native confirmation dialog.
- Symlinks and Windows junctions are not followed; hard links are counted once; virtual file systems (`/proc`, `/sys`, …) are skipped when scanning `/`.
- Sizes are logical file sizes (what file managers show), in 1024-based units.

## Project layout

```
engine/            Rust scanner (scan.rs, tree.rs, dupes.rs, protocol.rs)
src/main/          Electron main process: engine client, volumes, IPC
src/preload/       contextBridge API
src/renderer/      React UI (components/, lib/, i18n.tsx, styles.css)
src/shared/        Types and helpers shared by both sides
scripts/           Build helpers
docs/              Architecture diagram (regenerate: npm run docs:diagrams)
```

## Privacy

Ringfold works entirely offline. This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. There is no telemetry, no analytics and no update pings — scans stay on your computer.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
