# Windows Managed Prism Install

## Goal

Fix onboarding managed PrismLauncher-Cracked install on Windows x86_64.

## Acceptance Criteria

- Windows x86_64 selects a current GitHub release portable ZIP.
- Windows install extracts ZIP and resolves `prismlauncher.exe`.
- Existing Linux/macOS selection remains unchanged.
- Backend tests cover Windows asset names.
- Version is ready for release after validation.

## Context Links

- `src-tauri/src/prism/install.rs`
- `docs/quality.md`

## Steps

- Confirm latest upstream release asset names.
- Add Windows asset selection.
- Add Windows ZIP install branch.
- Add tests.
- Run checks.
- Sync release version if checks pass.

## Validation

- `cd src-tauri && cargo test`
- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

## Decision Log

- Prefer portable ZIPs over setup EXEs so app can install into modsync data dir without elevation or external installer UI.
- Prefer MSVC x64 portable first, then MinGW portable fallback, matching current release assets.

## Progress Log

- 2026-05-05: Latest `Diegiwg/PrismLauncher-Cracked` release `11.0.2-1` has Windows MSVC and MinGW portable ZIPs with GitHub SHA-256 digests.
- 2026-05-05: Added Windows asset selection, Windows ZIP install path, and backend tests.
- 2026-05-05: Synced app version to `1.2.3` for release.
