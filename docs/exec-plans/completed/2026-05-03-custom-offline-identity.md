# Custom Offline Identity

## Goal

Allow PrismLauncher-Cracked launches to use a saved offline username and UUID.

## Acceptance Criteria

- Settings can save offline username and optional UUID.
- Onboarding can save offline username and optional UUID.
- Launch writes an active Prism offline account using the exact UUID when provided.
- Existing username-only installs keep working with deterministic offline UUID fallback.
- SYSTEM UI uses existing `src/components/ui` primitives for controls.

## Context Links

- [openspec/specs/launcher-integration.md](../../openspec/specs/launcher-integration.md)
- [src-tauri/src/prism.rs](../../../src-tauri/src/prism.rs)
- [src/routes/settings.tsx](../../../src/routes/settings.tsx)
- [src/features/onboarding/onboarding-flow.tsx](../../../src/features/onboarding/onboarding-flow.tsx)

## Steps

- [x] Find existing Prism settings and account launch path.
- [x] Add backend persisted UUID and validation.
- [x] Add frontend settings/onboarding fields.
- [x] Update launcher spec.
- [x] Run checks.

## Validation

- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run test` (blocked: repo has no frontend test files, Vitest exits 1)
- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` (blocked: `cargo-clippy` missing from toolchain)
- `./scripts/check-sonata.sh`

## Decision Log

- Store UUID in settings as canonical hyphenated text.
- Write Prism `profile.id` as undashed text because launcher account files commonly store profile IDs that way.
- If UUID is blank, keep the previous offline-name-derived UUID behavior.

## Progress Log

- 2026-05-03: Plan created.
- 2026-05-03: Implementation done and validated. Moved to completed.
