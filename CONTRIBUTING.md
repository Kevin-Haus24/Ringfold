# Contributing to Ringfold

Thanks for helping! Bug reports, ideas and pull requests are all welcome.
Issues and PRs can be written in English or Russian.

## Setup

1. Install [Node.js](https://nodejs.org) 22+ and [Rust](https://rustup.rs) (stable).
2. `npm install`
3. `npm run dev` — builds the Rust engine and opens the app with hot reload.

On Windows without Visual Studio Build Tools, use the GNU toolchain:
`rustup default stable-x86_64-pc-windows-gnu`.

## Before opening a PR

```bash
npm run typecheck
cargo fmt --manifest-path engine/Cargo.toml
cargo clippy --manifest-path engine/Cargo.toml --all-targets -- -D warnings
npm run engine:test
```

CI runs the same checks on Windows, macOS and Linux.

## Guidelines

- Keep the UI translated: every new string goes into both dictionaries in `src/renderer/src/i18n.tsx`.
- Anything that modifies the user's files must go through the main process with a native confirmation and the system trash — never delete permanently.
- The engine protocol is documented in `engine/src/protocol.rs`; add new commands to `query()` in `engine/src/main.rs` and to the typed API in `src/shared/types.ts`.
- Small, focused PRs are easier to review.
