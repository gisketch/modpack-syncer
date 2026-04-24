# modsync — Planned Features

> Source-of-truth checklist. Update as features land. Owner: `gisketch`.
> See [architecture.md](./architecture.md) for design.

Legend: `[ ]` planned · `[~]` in progress · `[x]` done · `[?]` under discussion

---

## M0 — Foundation

- [ ] Tauri 2 + React + TypeScript scaffold
- [ ] Bun package manager configured
- [ ] Tailwind v4 + shadcn/ui base components
- [ ] Zustand store setup
- [ ] TanStack Query setup
- [ ] Rust workspace: `modsync-core` (logic) + `modsync-tauri` (app shell)
- [ ] SQLite (rusqlite) local DB with migrations
- [ ] Logging (`tauri-plugin-log` + `tracing`)
- [ ] App data dir resolution (cross-platform)
- [ ] Settings screen skeleton

## M1 — Pack ingest & mod download

- [ ] Add-pack flow: paste Gitea URL → clone via `git2`
- [ ] `manifest.json` parser + schema validation (serde)
- [ ] Mod download pipeline (reqwest + tokio, `Semaphore(8)` concurrency)
- [ ] SHA1 + SHA512 verification
- [ ] Content-addressable cache (`~/.local/share/modsync/cache/<sha1>.jar`)
- [ ] Resumable downloads (HTTP Range + `.part` files)
- [ ] Prism Launcher detection (user setting + platform defaults + PATH)
- [ ] Generate `instance.cfg` + `mmc-pack.json` per profile
- [ ] Write `.minecraft/mods/` into Prism instance
- [ ] Launch button → spawn `prismlauncher --launch <name>`

## M2 — Full content sync

- [ ] `configs/` sync (full-file overwrite, preserve user's non-tracked files)
- [ ] `kubejs/` sync
- [ ] `resourcepacks/` sync (Modrinth URL refs)
- [ ] `shaderpacks/` sync (Modrinth URL refs)
- [ ] `overrides/` drop-in support
- [ ] Sync toggles UI per profile
- [ ] Dry-run preview before applying sync

## M3 — MinIO / custom assets

- [ ] MinIO client (`aws-sdk-s3`)
- [ ] `assets-manifest.json` parser
- [ ] Download custom resourcepacks/shaderpacks from MinIO
- [ ] MinIO URL + key management in settings (keychain-stored)
- [ ] CF-blocked mod fallback to MinIO mirror

## M4 — Author mode

- [ ] Role detection (can push to git remote?)
- [ ] Scan local Prism instance → compute diff vs manifest
- [ ] Modrinth API lookup by SHA1 (auto-resolve mod metadata)
- [ ] CurseForge API lookup by fingerprint
- [ ] Manifest editor UI (bump versions, add/remove mods)
- [ ] MinIO upload for new custom assets
- [ ] CHANGELOG editor
- [ ] Commit + tag + push via `git2` (PAT from keychain)
- [ ] Publish wizard (version bump, changelog, confirm, push)

## M5 — UX polish

- [ ] Diff viewer: mod adds/removes/version changes, config line diffs
- [ ] Changelog viewer in-app
- [ ] Adoptium JDK 21 auto-downloader
- [ ] Per-profile Java selector
- [ ] RAM/JVM args tuner UI
- [ ] Update check on app open (fetch + notify)
- [ ] Onboarding wizard (first run: detect Prism, download Java, paste pack URL)
- [ ] Prism Launcher auto-install prompt if not detected (opens official download page / silent installer where possible)

## M6 — Partial-file sync & edge cases

- [ ] `options.txt` keybind-only merge (preserve video/audio settings)
- [ ] `servers.dat` NBT-aware merge (don't clobber user's personal servers)
- [ ] Optional mods (client-side toggles per user)
- [ ] Client/server-side mod filtering
- [ ] Offline mode (use cached jars, skip update check)

## M7 — Ambient features (post-v1 ideas)

- [ ] Auto-backup saves before applying update
- [ ] Rollback to previous pack version (git revert + re-sync)
- [ ] Pack version channels: `stable` / `beta` / `dev` (git branches)
- [ ] Discord Rich Presence ("playing modsync v0.3.1")
- [ ] Server list sync + live ping status
- [ ] Mod search + add from UI (Modrinth/CF browser)
- [ ] Screenshot gallery viewer
- [ ] Crash report uploader + basic analyzer
- [ ] Friend presence ("who's playing what right now")
- [ ] Multi-pack support (one app, several packs)
- [ ] World sync for small co-op worlds (MinIO or git-LFS)
- [ ] Self-update (`tauri-plugin-updater`)
- [ ] Telemetry opt-in (anon error reports)
- [ ] Theme system (dark/light + accents)
- [ ] i18n scaffolding

## Cross-cutting

### Security
- [ ] PAT/MinIO creds in OS keychain
- [ ] Manifest URL host allowlist
- [ ] SHA verification mandatory (no bypass)
- [ ] Reject manifests with unknown schema version

### Testing
- [ ] `cargo test` — manifest parsing, hash verify, diff logic
- [ ] `vitest` — UI state reducers, form validation
- [ ] Integration test: full sync against a fixture Gitea repo
- [ ] E2E test: fresh install → launch (CI headless)

### Docs
- [x] `docs/architecture.md`
- [x] `docs/planned_features.md`
- [ ] `README.md` (user-facing quickstart)
- [ ] `docs/author-guide.md` (publishing flow)
- [ ] `docs/vps-setup.md` (Gitea + MinIO on your VPS)
- [ ] `docs/manifest-schema.md` (JSON schema reference)

### Build / Release
- [ ] GitHub Actions: lint + test + build (Linux/Windows/macOS)
- [ ] Signed releases (code signing later)
- [ ] Auto-update server (or GitHub Releases)
