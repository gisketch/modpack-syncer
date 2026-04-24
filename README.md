# gisketch//s_modpack_syncer

Minecraft Java modpack syncer + Prism Launcher wrapper, built for **gisketch//s_modpack_syncer** with **Tauri 2 + React + TypeScript**.

One binary that keeps you and your friends on the exact same mods, configs, KubeJS scripts, resource packs, and shader packs — pulled from a single source of truth (your Gitea repo) and launched through Prism.

## Status

Early scaffold. See [docs/planned_features.md](docs/planned_features.md) for the roadmap and [docs/architecture.md](docs/architecture.md) for the design.

## Stack

- **App shell**: Tauri 2
- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Zustand, TanStack Query
- **Backend**: Rust (tokio, reqwest, git2, aws-sdk-s3, rusqlite)
- **Package manager**: Bun
- **Launcher**: Prism Launcher (detected, not bundled)

## Dev prerequisites

- [Bun](https://bun.sh)
- [Rust toolchain](https://rustup.rs)
- Linux: `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2`, `build-essential`
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools + WebView2

See https://tauri.app/start/prerequisites/ for the full OS matrix.

## Dev

```bash
bun install
bun run tauri dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Vite dev server only (frontend) |
| `bun run tauri dev` | Full Tauri app (Rust + frontend) |
| `bun run build` | Frontend production build |
| `bun run tauri build` | Full app bundle |
| `bun run release:sync <version>` | Sync app version across UI/build config files |
| `bun run release:tag <version>` | Verify clean tree, then create + push release tag |
| `bun run release:verify <tag>` | Verify a `v*` tag matches all release version files |
| `bun run test` | Vitest (frontend) |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format |
| `bun run typecheck` | TypeScript no-emit check |

## Releases

Windows app releases publish through GitHub Actions.

See [docs/update_syncer.md](docs/update_syncer.md) for the full step-by-step release runbook.

```bash
bun run release:sync 0.1.0
# review + commit version changes
bun run release:tag 0.1.0
```

`release:sync` updates [package.json](package.json), [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json), and [src-tauri/Cargo.toml](src-tauri/Cargo.toml) so runtime UI version and packaged app version stay aligned.

`release:tag` refuses to run unless working tree clean and all version files already match the requested release. This keeps tag creation safe without auto-committing release changes.

Pushing a `v*` tag runs [.github/workflows/release-windows.yml](.github/workflows/release-windows.yml), builds Tauri on `windows-latest`, and uploads Windows bundle assets to that tag's GitHub Release page. The same workflow also supports manual dispatch from Actions when you provide an existing tag.

Windows updater support is enabled for packaged Windows builds only. On launch, gisketch//s_modpack_syncer checks the latest GitHub release updater manifest and shows `UPDATE NOW` in the sidebar only when an update exists. Non-Windows builds hide updater UI entirely.

Before Windows updater builds can publish successfully, add these GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional if key has no password)

## Layout

```
.
├── src/                  # React frontend
│   ├── app.tsx
│   ├── main.tsx
│   ├── routes/
│   ├── features/
│   ├── components/ui/
│   ├── stores/
│   ├── lib/
│   └── styles/
├── src-tauri/            # Rust backend
│   └── src/
│       ├── lib.rs
│       ├── manifest.rs
│       ├── profile.rs
│       ├── git.rs
│       ├── download.rs
│       ├── cache.rs
│       ├── prism.rs
│       ├── db.rs
│       └── keychain.rs
└── docs/
    ├── architecture.md
    └── planned_features.md
```

## License

TBD.
