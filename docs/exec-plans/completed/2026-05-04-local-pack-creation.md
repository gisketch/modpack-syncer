# Local Pack Creation

## Goal

Let users create a local-only modpack repository from the app.

## Acceptance Criteria

- Home screen exposes local pack creation beside remote clone.
- Created pack is a normal git repository under the managed packs directory.
- Created pack has `manifest.json`, an initial commit, and no `origin` remote.
- Local packs can be opened, edited in Builder, synced, and launched.
- Fetch/action refresh on a local pack is a no-op instead of an error.
- Specs and checks stay current.

## Context Links

- [docs/architecture/index.md](../../architecture/index.md)
- [docs/quality.md](../../quality.md)
- [openspec/specs/sync-engine.md](../../../openspec/specs/sync-engine.md)
- [openspec/specs/manifest.md](../../../openspec/specs/manifest.md)
- [src/routes/home.tsx](../../../src/routes/home.tsx)
- [src-tauri/src/commands/packs.rs](../../../src-tauri/src/commands/packs.rs)
- [src-tauri/src/git.rs](../../../src-tauri/src/git.rs)

## Steps

- [x] Map pack clone/add flow.
- [x] Add backend local repo init command.
- [x] Add frontend local pack controls and typed API.
- [x] Make remote refresh safe for local-only repos.
- [x] Update OpenSpec.
- [x] Run quality checks.

## Validation

- `bun run typecheck` - passed.
- `bun run lint` - passed.
- `bun run test` - blocked: no frontend test files exist, Vitest exits 1.
- `bun run build` - passed, with existing large chunk warning.
- `./scripts/check-sonata.sh` - passed.
- `cd src-tauri && cargo fmt --check` - passed.
- `cd src-tauri && cargo test` - passed.
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` - blocked: `cargo-clippy` component missing for current toolchain.

## Decision Log

- Use a real initial git commit so existing HEAD-based manifest flows keep working.
- Local-only identity is inferred from missing `origin`; remote can be added later outside or by future app flow.

## Progress Log

- 2026-05-04: Started local pack creation implementation.
- 2026-05-04: Added local init command, UI creator, no-origin refresh handling, and spec note.
- 2026-05-04: Validation complete; moved plan to completed.
