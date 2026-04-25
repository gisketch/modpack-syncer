# Change: m0-foundation

- **Status**: shipped
- **Milestone**: M0
- **Owner**: gisketch

## Outcome

Foundation shipped. Tauri + React + TypeScript app shell, Bun tooling, TanStack Query, Zustand persistence, Rust subsystem modules, onboarding/settings shell, and typed Tauri command bridge now exist in the main codebase.

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

- Baseline app shell and runtime plumbing landed.
- Rust backend modules and typed Tauri bridge landed.
- Foundation requirements now live in the baseline specs and code.

## Tasks

- [x] Scaffold Tauri + React + TS via `create-tauri-app`
- [x] Configure Bun scripts (dev, build, test, lint, typecheck)
- [x] Tailwind v4 via `@tailwindcss/vite`
- [x] App shell with TanStack Query + home route
- [x] Zustand app store skeleton
- [x] Rust module skeletons committed
- [x] Tauri plugins registered + capabilities updated
- [x] `biome.json`, `vitest.config.ts`, `src/test/setup.ts`
- [x] Local `cargo check` path proven during active development
- [x] Initial project history established

## Follow-ups

See baseline specs in `openspec/specs/` for current authoritative behavior and newer change files for still-open work.
