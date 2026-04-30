# Fast Sync Metadata

## Goal

Refactor sync so artifact fetch/status/write paths use filename and file size instead of hashing files during normal sync.

## Acceptance Criteria

- Cache hits do not hash artifact bytes.
- Sync resolve/status does not hash artifacts.
- Managed mods/resourcepacks/shaderpacks/config trees overwrite existing instance files instead of silently leaving stale files.
- Disabled artifact restore is idempotent and prunes stale state.
- Fresh Sync can delete the Prism instance and rebuild it from source.
- Sync and Launch refresh the pack before proceeding and gate Launch when refreshed head differs from last synced commit.
- OpenSpec reflects metadata-fast sync policy.
- Targeted backend checks pass.

## Context Links

- [sync-engine spec](../../../openspec/specs/sync-engine.md)
- [download.rs](../../../src-tauri/src/download.rs)
- [prism.rs](../../../src-tauri/src/prism.rs)
- [status.rs](../../../src-tauri/src/commands/status.rs)

## Steps

- [x] Replace SHA cache lookup/verification with filename+size metadata lookup.
- [x] Remove sync-time artifact hash verification.
- [x] Make managed writes force-overwrite existing files.
- [x] Update sync status to use size comparison.
- [x] Add idempotent disabled restore and Fresh Sync instance rebuild.
- [x] Add pre-sync/pre-launch pack refresh guard.
- [x] Update docs/specs.
- [x] Run validation.

## Validation

- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo check`
- `bun run lint`
- `bun run typecheck`
- `./scripts/check-sonata.sh`

## Decision Log

- User explicitly chose speed over SHA checking/comparing/storing in sync.
- Keep manifest SHA fields for compatibility with publish/Modrinth metadata and existing schema, but stop using them in normal sync/status paths.

## Progress Log

- 2026-05-01: Started from user request to optimize fetch/sync and force instance overwrite.
- 2026-05-01: Implemented metadata cache, size-only sync checks, forced managed overwrites, and spec/doc updates.
- 2026-05-01: `cargo fmt --check`, `cargo test`, `cargo check`, `bun run lint`, `bun run typecheck`, and `./scripts/check-sonata.sh` passed. `bun run test` found no frontend test files. `cargo clippy` could not run because the stable toolchain is missing `cargo-clippy`.
- 2026-05-01: Added Fresh Sync and made disabled artifact restore ignore stale local state.
- 2026-05-01: Added lightweight action refresh for Sync/Launch. Manual Fetch still performs full checkout cleanup; action refresh skips checkout when the fetched head is unchanged.
- 2026-05-01: Investigated local pack fetch cost. Pack clone is 675M total, `.git` is 301M, configs are 174M, shaderpacks are 96M, and raw `git fetch origin` measured about 0.85s in this environment. App delay is likely from libgit2 plus forced checkout/cleanup on unchanged fetches.
