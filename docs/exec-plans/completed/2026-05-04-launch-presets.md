# Launch Presets

## Goal

Move launch memory profiles, max RAM defaults, and JVM args from app constants into pack-owned `launch_presets/`.

## Acceptance Criteria

- Pack repos can define launch presets under `launch_presets/*.json`.
- `launch_presets/default.json` seeds local launch profile defaults.
- Existing packs missing launch presets auto-generate default files into the repo working tree.
- Generated launch preset files are visible in publish preview and commit/push flow.
- Launch setup quick preset cards are loaded from the pack repo, not hardcoded in React.
- New local packs generate `launch_presets/default.json` with the current values.
- Existing user launch profile overrides still persist locally.
- OpenSpec documents pack-owned launch preset behavior.

## Context Links

- [docs/architecture/index.md](../../architecture/index.md)
- [docs/quality.md](../../quality.md)
- [openspec/specs/launcher-integration.md](../../../openspec/specs/launcher-integration.md)
- [src/features/packs/launch-profile/launch-setup-panel.tsx](../../../src/features/packs/launch-profile/launch-setup-panel.tsx)
- [src-tauri/src/prism.rs](../../../src-tauri/src/prism.rs)
- [src-tauri/src/commands/prism_control.rs](../../../src-tauri/src/commands/prism_control.rs)

## Steps

- [x] Map current launch profile and setup UI.
- [x] Add backend launch preset model and repo loader.
- [x] Generate default launch preset for local pack creation.
- [x] Wire Tauri command and frontend types.
- [x] Replace hardcoded memory cards with repo presets.
- [x] Update spec/docs.
- [x] Run validation.

## Validation

- `bun run typecheck` - passed.
- `bun run lint` - passed.
- `bun run build` - passed, with existing large chunk warning.
- `bun run release:verify v1.2.1` - passed.
- `bun run test` - blocked: no frontend test files exist, Vitest exits 1.
- `./scripts/check-sonata.sh` - passed.
- `cd src-tauri && cargo check` - passed.
- `cd src-tauri && cargo fmt --check` - passed.
- `cd src-tauri && cargo test` - passed.
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` - blocked: `cargo-clippy` component missing for current toolchain.

## Decision Log

- Keep user `launch-profile` as local override storage; only seed missing profile from repo-owned default.
- Use `launch_presets/default.json` as the required default preset id.
- Store memory slider bounds and step in `launch_presets/default.json` through `memoryRange`.

## Progress Log

- 2026-05-04: Started launch preset repo ownership implementation.
- 2026-05-04: Added backend loader/config command, local pack generation, frontend wiring, spec update, and validation.
- 2026-05-04: Added self-healing launch preset generation for existing packs and publish preview coverage.
