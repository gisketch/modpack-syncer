# Copilot instructions for modsync

> Read this first when working in this repo.

## Project

`modsync` is a Minecraft modpack syncer + Prism Launcher wrapper. See:

- [README.md](../README.md)
- [docs/architecture.md](../docs/architecture.md) — design, data flow, stack
- [docs/planned_features.md](../docs/planned_features.md) — roadmap, source-of-truth checklist
- [openspec/config.yaml](../openspec/config.yaml) — project metadata
- [openspec/specs/](../openspec/specs/) — behavioral specs (manifest, profiles, sync-engine, launcher-integration)
- [openspec/changes/](../openspec/changes/) — in-flight changes

## Stack facts

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 (`@tailwindcss/vite`) + Zustand + TanStack Query + shadcn-style components (hand-rolled in `src/components/ui`).
- **Backend**: Rust 2021, Tauri 2. Async via tokio, HTTP via reqwest (rustls), git via `git2` (vendored libgit2, no system git), DB via `rusqlite` (bundled).
- **Package manager**: **Bun** (not npm/yarn/pnpm). Use `bun`, `bun add`, `bun run`, `bunx`.
- **Path alias**: `@/*` → `src/*` in both `tsconfig.json` and `vite.config.ts`.

## Non-negotiables

- **SHA verification** is mandatory for every downloaded artifact. Never bypass it.
- **Do not bundle Prism Launcher**. Detect an existing install; write instance folders only.
- **Do not collect Microsoft credentials**. Prism handles MS auth.
- **Secrets** (GitHub PAT) go in the OS keychain via the `keyring` crate. Never on disk plain, never in logs.
- **Manifest URL allowlist** must be enforced (see spec `manifest.md`).
- **No mod jars in git.** Manifest references upstream CDNs (Modrinth / CurseForge); git holds only text (manifest, configs, kubejs, profiles).

## Conventions

- Rust module files live flat under `src-tauri/src/` (`manifest.rs`, `git.rs`, …). Keep each module focused.
- React routes → `src/routes/`, feature slices → `src/features/<domain>/`, reusable UI → `src/components/ui/`, zustand → `src/stores/`.
- Commands exposed to the frontend are typed in `src/lib/tauri.ts` — keep in sync with `src-tauri/src/lib.rs#invoke_handler`.
- Use `cn()` from `@/lib/cn` for conditional classnames. Prefer Tailwind utilities over ad-hoc CSS.
- Biome is the formatter/linter for JS/TS. `cargo fmt` + `clippy` for Rust.

## Testing

- Frontend: `bun run test` (vitest + jsdom + @testing-library).
- Rust: `cargo test` inside `src-tauri`.

## OpenSpec flow

When proposing a new behavior or milestone, add a file under `openspec/changes/`, then once shipped, move/duplicate the authoritative requirements into `openspec/specs/` and mark the change archived.
