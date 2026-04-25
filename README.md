# modsync

Minecraft Java modpack syncer + Prism Launcher wrapper, built with **Tauri 2 + React + TypeScript**.

I made modsync for me and my friends so we can play custom Minecraft packs without passing files around or debugging who has the wrong config. Mods, configs, KubeJS scripts, resource packs, shader packs, profiles, and options live in one GitHub source of truth. The app pulls that into Prism and keeps everyone on the same version.

The point is simple: one app for the packs we make now, and the packs we keep tweaking later. I like tuning things until they feel right, and modsync turns that work into something everyone can use without setup becoming homework.

## Status

Active private/friend-group tool. See [docs/planned_features.md](docs/planned_features.md) for the roadmap and [docs/architecture.md](docs/architecture.md) for the design.

## Stack

- **App shell**: Tauri 2
- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Zustand, TanStack Query
- **Backend**: Rust (tokio, reqwest, git2, rusqlite)
- **Package manager**: Bun
- **Launcher**: Prism Launcher wrapper/managed installer flow

## What It Does

- Clones pack repos from GitHub and treats them as the source of truth.
- Syncs mods, resource packs, shader packs, configs, KubeJS, profiles, and options into Prism instances.
- Verifies downloaded artifacts by SHA before writing them.
- Lets pack admins publish local instance changes back into the repo preview-first.
- Supports option presets, shader settings review, per-file publish ignore rules, and launch gating when packs are behind.

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
