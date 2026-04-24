# modsync — Architecture

> Minecraft Java modpack sync + launcher wrapper. Tauri 2 (Rust backend) + React (TypeScript frontend).
> Owner: `gisketch` · Bundle: `dev.gisketch.modsync` · MC target: `1.21.1` (NeoForge + Fabric, equal priority)

---

## 1. Core Philosophy

- **Single binary** — friends install one app, no git/java/extra tools required.
- **Clean separation of concerns** — git holds text, CDN holds mod jars, object storage holds custom binaries.
- **Same app = two modes** — consumer (pull/sync/launch) and author (edit/publish/push). Role is inferred from git remote write access.
- **Minecraft-aware but launcher-delegating** — we manage pack files; Prism Launcher handles MS auth + JVM launch.

---

## 2. Source of Truth

### 2.1 Storage layers

| Layer | Holds | Why |
|-------|-------|-----|
| **GitHub** (public repo) | `manifest.json`, `configs/`, `kubejs/`, `profiles/*.json`, `CHANGELOG.md` | Text/small files. Diffable. Free versioning. |
| **Modrinth / CurseForge CDN** | Public mod jars, public resourcepacks, public shaderpacks | Zero self-hosting cost. Hash-verified. Upstream. |
| **Local SQLite** (client) | Download cache index, profile state, last-synced commit SHA, user settings | Fast local queries, no server round-trip for UI. |

### 2.2 Repo layout (GitHub)

```
gisketch/modsync-pack/
├── manifest.json              # pinned mod refs + hashes + URLs
├── profiles/
│   ├── default.json           # sync toggles, JVM args, Java version
│   └── lite.json              # example: "no shaders" variant
├── configs/                   # mod config files (tracked)
├── kubejs/                    # KubeJS scripts
├── overrides/                 # any extra files to drop in .minecraft/
├── CHANGELOG.md
└── README.md
```

### 2.3 `manifest.json` shape

```jsonc
{
  "schemaVersion": 1,
  "pack": { "name": "modsync", "version": "0.3.0", "mcVersion": "1.21.1", "loader": "neoforge", "loaderVersion": "21.1.77" },
  "mods": [
    {
      "id": "sodium",
      "source": "modrinth",           // "modrinth" | "curseforge" | "url"
      "projectId": "AANobbMI",
      "versionId": "Yp8wLY1P",
      "filename": "sodium-neoforge-0.6.0.jar",
      "sha1": "…",
      "sha512": "…",
      "size": 1234567,
      "url": "https://cdn.modrinth.com/…",
      "optional": false,
      "side": "client"
    }
  ],
  "resourcepacks": [ /* same shape, side: "client" */ ],
  "shaderpacks":   [ /* same shape */ ]
}
```

### 2.4 `profiles/*.json` shape

```jsonc
{
  "name": "default",
  "pack": "gisketch/modsync-pack",
  "ref": "main",                       // git branch or tag
  "mcVersion": "1.21.1",
  "loader": "neoforge",
  "sync": {
    "mods": true,
    "configs": true,
    "kubejs": true,
    "resourcepacks": true,
    "shaderpacks": true,
    "keybinds": false,                 // options.txt
    "servers": true                    // servers.dat
  },
  "java": { "version": 21, "autoDownload": true, "xms": "2G", "xmx": "8G", "extraArgs": [] },
  "prismInstanceName": "modsync-default"
}
```

---

## 3. Data Flow

### 3.1 Consumer — initial install
```
User → App: add pack URL (github.com/gisketch/modsync-pack)
App  → GitHub: libgit2 clone to app data dir
App  → manifest.json: parse
App  → Modrinth/CF: parallel download mod jars (reqwest + tokio)
App  → SHA verify every jar
App  → Prism instances/: write .minecraft/ (mods, configs, kubejs, …)
App  → User: "Ready, launch?"
```

### 3.2 Consumer — update check
```
App (on open): libgit2 fetch origin
App: compare local HEAD vs remote HEAD
UI: show diff (added mods, removed mods, version bumps, config changes)
User: Apply → app deletes/downloads delta → commit SHA bump in SQLite
```

### 3.3 Author — publish
```
Author: opens instance in app → "Scan for changes"
App: diffs Prism instance vs manifest
App: fetches new mod metadata from Modrinth/CF APIs by filename/hash match
UI: shows proposed manifest update
Author: edits CHANGELOG → click "Publish v0.3.1"
App:
  - updates manifest.json
  - git add, commit, tag, push (libgit2)
```

---

## 4. Tech Stack

### 4.1 Frontend

| Concern | Pick |
|---------|------|
| Framework | React 18 + TypeScript |
| Bundler | Vite (Tauri default) |
| State | Zustand |
| Server/Tauri state | TanStack Query |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Router | React Router v7 |
| Icons | lucide-react |

### 4.2 Backend (Rust, Tauri 2)

| Concern | Crate |
|---------|-------|
| Async runtime | `tokio` |
| HTTP | `reqwest` (rustls, http2) |
| Git | `git2` (libgit2 bindings) |
| Local DB | `rusqlite` + `r2d2` pool |
| Hashing | `sha1`, `sha2` |
| Zip/archives | `zip`, `async-compression` |
| Serde | `serde`, `serde_json`, `toml` |
| Tauri plugins | `tauri-plugin-dialog`, `-fs`, `-shell`, `-os`, `-updater`, `-log` |
| Errors | `thiserror`, `anyhow` |

### 4.3 Tooling

- `bun` (package manager + runner)
- `cargo fmt`, `clippy`
- `biome` (lint/format JS/TS)
- `vitest` (frontend tests)
- `cargo test` (Rust)

---

## 5. Launcher Integration (Prism)

- **Strategy**: detect Prism install path → write/update instance in its `instances/<name>/`.
- **Detection order**:
  1. User-configured path (setting)
  2. Platform defaults (`~/.local/share/PrismLauncher`, `%APPDATA%\PrismLauncher`, `~/Library/Application Support/PrismLauncher`)
  3. `prismlauncher` on PATH
- **Instance write**: `mmc-pack.json` + `instance.cfg` generated per profile (loader, MC version, JVM args).
- **Launch**: spawn `prismlauncher --launch <instanceName>` (or `-l`). Prism handles MS auth, asset download, JVM.
- **No bundling** of Prism (license, size, update churn).
- **Java**: auto-download Adoptium JDK 21 to app data dir; point Prism instance at it via `JavaPath` in `instance.cfg`.

---

## 6. Sync Granularity (per-profile toggles)

| Toggle | What it syncs | Notes |
|--------|---------------|-------|
| `mods` | `.minecraft/mods/*.jar` | always recommended |
| `configs` | `.minecraft/config/**` | text diff-friendly |
| `kubejs` | `.minecraft/kubejs/**` | scripts |
| `resourcepacks` | `.minecraft/resourcepacks/**` | Modrinth URLs |
| `shaderpacks` | `.minecraft/shaderpacks/**` | same |
| `keybinds` | `options.txt` (keybind lines only) | partial-file merge to preserve user's video settings |
| `servers` | `servers.dat` | NBT merge (don't clobber user's extra servers) |

Toggles stored in `profiles/*.json`; the *pack* can declare "recommended" defaults, but the user's local overrides win.

---

## 7. Security

- GitHub PAT stored via OS keychain (`tauri-plugin-stronghold` or `keyring` crate).
- Every download SHA1 + SHA512 verified against manifest before writing to disk.
- Manifest `url` fields validated against allowlist (modrinth.com, curseforge CDN host).
- No `eval`/dynamic code execution from manifest.

---

## 8. Performance

- Parallel downloads (tokio + reqwest, bounded by `Semaphore(8)`).
- Resumable downloads (HTTP Range, `.part` files).
- Content-addressable on-disk cache: `~/.local/share/modsync/cache/<sha1>.jar` — swap into instances via copy (or reflink on btrfs/apfs).
- Updates only fetch *changed* files (diff manifest old vs new).

---

## 9. Roadmap Phasing

- **M0** — scaffold + GitHub clone + manifest parse (read-only).
- **M1** — Mod download + SHA verify + Prism instance write + launch.
- **M2** — Full sync (configs, kubejs, resourcepacks via Modrinth).
- **M3** — Author mode: scan/diff/publish flow.
- **M4** — Diff viewer, changelog UI, Adoptium auto-download.
- **M5** — Partial-file sync (keybinds, servers.dat), polish, release.
