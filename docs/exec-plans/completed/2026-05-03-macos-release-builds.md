# macOS Release Builds

## Goal

Add automated macOS release builds beside the existing Windows release build.

## Acceptance Criteria

- Release workflow builds Windows and macOS assets for version tags.
- macOS builds include Apple Silicon and Intel targets.
- Existing updater signing secret flow remains unchanged.
- Release guide explains whether a physical Mac is required.

## Context Links

- [.github/workflows/release-windows.yml](../../../.github/workflows/release-windows.yml)
- [docs/update_syncer.md](../../update_syncer.md)
- [src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json)

## Steps

- [x] Inspect current release workflow.
- [x] Convert release workflow to desktop matrix.
- [x] Update release docs.
- [x] Run checks.

## Validation

- `bun run lint`
- `bun run typecheck`
- `python3 -c 'import yaml, pathlib; yaml.safe_load(pathlib.Path(".github/workflows/release-desktop.yml").read_text()); print("workflow yaml ok")'`
- `./scripts/check-sonata.sh`
- `git diff --check`

## Decision Log

- Use GitHub-hosted `macos-latest` runners. No local Mac needed for CI builds.
- Build separate `aarch64-apple-darwin` and `x86_64-apple-darwin` artifacts instead of one universal build.
- Keep Apple code signing/notarization out of this change; unsigned macOS assets may still trigger Gatekeeper warnings.

## Progress Log

- 2026-05-03: Plan created.
- 2026-05-03: Workflow and docs updated. Local checks passed.
