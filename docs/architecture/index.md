# Architecture

## Current Shape

- Kind: existing Tauri desktop app.
- Frontend: React 19, TypeScript, Vite, Tailwind v4, Zustand, TanStack Query.
- Backend: Rust 2021, Tauri 2, tokio, reqwest, git2, rusqlite.
- Specs: [openspec/config.yaml](../../openspec/config.yaml), [openspec/specs](../../openspec/specs), and [openspec/changes](../../openspec/changes).

## Boundary Map

- [src/routes](../../src/routes): thin route entry points.
- [src/features](../../src/features): feature-owned UI, hooks, adapters, and helpers.
- [src/components/ui](../../src/components/ui): reusable UI primitives only.
- [src/stores](../../src/stores): shared client state.
- [src/lib](../../src/lib): shared frontend utilities and typed Tauri API surface.
- [src-tauri/src/commands](../../src-tauri/src/commands): Tauri command handlers.
- [src-tauri/src](../../src-tauri/src): backend domain modules for manifest, profile, git, download, cache, Prism, DB, paths, and keychain.
- [openspec/specs](../../openspec/specs): behavior source of truth.
- [docs](../../docs): harness, runbooks, architecture notes, and decisions.

## Default Layer Direction

Use this direction unless a spec documents a tighter boundary:

```text
spec -> type/schema -> data/cache -> service/domain -> command/runtime -> route/interface
```

Cross-cutting concerns should enter through explicit provider interfaces.

## Application Skeleton

- [src](../../src): React frontend.
- [src-tauri](../../src-tauri): Rust/Tauri backend.
- [openspec](../../openspec): specs and proposed changes.
- [scripts](../../scripts): release and harness scripts.
- [tests](../../tests): shared fixtures or cross-stack tests when added.
- [config](../../config): local config examples and fixtures when added.
- [docs/architecture.md](../architecture.md): preserved long-form architecture notes.

## Boundary Rule

If a dependency direction matters, document it here, then enforce it with checks when possible.

## Harness Rule

For behavior changes, update the relevant OpenSpec spec or change file in the same session. For broad work, create an execution plan under [docs/exec-plans/active](../exec-plans/active).
