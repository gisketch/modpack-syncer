# Change: m0-foundation

- **Status**: proposed
- **Milestone**: M0
- **Owner**: gisketch

## Goal

Stand up the empty shell: Tauri + React + TS scaffold, Bun, Tailwind v4, Zustand + TanStack Query, Rust module skeletons, SQLite, logging. No domain logic yet.

## Scope

- Project scaffolding and tooling (done in initial commit).
- Wire Tauri plugins (dialog, fs, shell, os, log).
- Define Rust module skeletons for `manifest`, `profile`, `git`, `download`, `cache`, `prism`, `db`, `keychain`.
- Baseline UI shell with home route + greet command round-trip to prove FE↔BE plumbing.

## Out of scope

- Any actual pack cloning, downloading, or launching. Those land in M1.

## Acceptance

- `bun install` succeeds.
- `bun run tauri dev` opens a window showing "modsync" + backend greet response (when system Tauri prereqs are installed).
- `cargo check` in `src-tauri` passes.
- `bun run typecheck` passes.
- `bun run lint` passes.

## Tasks

- [x] Scaffold Tauri + React + TS via `create-tauri-app`
- [x] Configure Bun scripts (dev, build, test, lint, typecheck)
- [x] Tailwind v4 via `@tailwindcss/vite`
- [x] App shell with TanStack Query + home route
- [x] Zustand app store skeleton
- [x] Rust module skeletons committed
- [x] Tauri plugins registered + capabilities updated
- [x] `biome.json`, `vitest.config.ts`, `src/test/setup.ts`
- [ ] First `cargo check` clean locally (requires system webkit2gtk)
- [ ] Initial git commit on `main`

## Follow-ups

See [docs/planned_features.md](../../docs/planned_features.md) M1–M7.
