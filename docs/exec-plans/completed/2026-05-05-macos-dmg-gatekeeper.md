# macOS DMG Gatekeeper Mitigation

## Goal

Stop Apple Silicon release DMGs from opening as corrupted or damaged on macOS.

## Acceptance Criteria

- Release workflow ad-hoc signs macOS builds when Apple Developer signing secrets are absent.
- Release workflow supports Developer ID signing and notarization when Apple secrets are configured.
- Release guide documents the immediate quarantine workaround and the durable signing/notarization fix.
- OpenSpec records macOS release signing expectations.

## Context Links

- [.github/workflows/release-desktop.yml](../../../.github/workflows/release-desktop.yml)
- [docs/update_syncer.md](../../update_syncer.md)
- [openspec/specs/app-updates.md](../../../openspec/specs/app-updates.md)

## Steps

- [x] Inspect release workflow and live release assets.
- [x] Update release workflow signing behavior.
- [x] Update release docs and OpenSpec.
- [x] Run validation.

## Validation

- `python3 -c 'import yaml, pathlib; yaml.safe_load(pathlib.Path(".github/workflows/release-desktop.yml").read_text()); print("workflow yaml ok")'`
- `./scripts/check-sonata.sh`
- `bun run typecheck`
- `git diff --check`

## Decision Log

- Live aarch64 DMG is present and non-empty; failure matches macOS Gatekeeper behavior for unsigned/unnotarized downloaded apps.
- Ad-hoc signing is the no-account mitigation for Apple Silicon, but Developer ID signing plus notarization is the durable public release fix.

## Progress Log

- 2026-05-05: Added macOS ad-hoc signing fallback plus optional Developer ID signing/notarization CI inputs.
- 2026-05-05: Updated release guide and OpenSpec. Validation passed.