# Manual Java Autofill

## Goal

When launch Auto Java is off, autofill Java path from onboarding-managed Temurin runtime.

## Acceptance Criteria

- Backend exposes installed managed Java runtime path by major version.
- Pack detail autofills only when `autoJava=false` and `javaPath` is empty.
- Existing custom Java paths are not overwritten.
- Validation checks pass before release.

## Context Links

- `src-tauri/src/prism.rs`
- `src-tauri/src/commands/prism_control.rs`
- `src/routes/pack-detail.tsx`

## Steps

- Add managed Java runtime lookup.
- Expose Tauri command.
- Add frontend query/effect for manual Java empty path.
- Run checks.
- Bump patch version and publish tag after validation.

## Validation

- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test` fails because repo has no Vitest files.

## Decision Log

- Use pack-recommended Java major first, matching install choices.
- Do not mutate profiles that already have a Java path.

## Progress Log

- 2026-05-05: Started after `v1.2.3` Windows release build succeeded.
- 2026-05-05: Added managed runtime lookup command and manual Java autofill.
