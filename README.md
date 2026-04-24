# modsync

Minecraft Java modpack syncer + Prism Launcher wrapper, built with **Tauri 2 + React + TypeScript**.

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
| `bun run test` | Vitest (frontend) |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format |
| `bun run typecheck` | TypeScript no-emit check |

## Releases

Windows app releases publish through GitHub Actions.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing a `v*` tag runs [.github/workflows/release-windows.yml](.github/workflows/release-windows.yml), builds Tauri on `windows-latest`, and uploads Windows bundle assets to that tag's GitHub Release page. The same workflow also supports manual dispatch from Actions when you provide an existing tag.

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
