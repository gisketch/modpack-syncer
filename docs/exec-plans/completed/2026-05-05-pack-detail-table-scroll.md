# Pack Detail Table Scroll

## Goal

Keep pack detail page scrolling under the cursor when the cursor is over the mods, resourcepacks, or shaderpacks tables.

## Acceptance Criteria

- Wheel input over pack detail artifact tables scrolls the page vertically.
- Artifact tables remain searchable, sortable, and paginated.
- Release version is pushed after validation.

## Context Links

- [Pack detail route](../../../src/routes/pack-detail.tsx)
- [Launcher integration spec](../../../openspec/specs/launcher-integration.md)
- [Quality](../../quality.md)

## Steps

- [x] Remove nested vertical scroll areas from artifact tables.
- [x] Record the UI behavior in OpenSpec.
- [x] Run frontend and release checks.
- [x] Commit, tag, and push release.

## Validation

- Passed: `bun run typecheck`
- Passed: `bun run lint`
- Passed: `bun run build`
- Passed: `./scripts/check-sonata.sh`
- Passed: `bun run release:verify v1.2.2`
- Passed with warnings: `cd src-tauri && cargo check`

## Decision Log

- Use non-scrollable table containers for pack detail artifact lists so the document remains the vertical scroll owner.

## Progress Log

- 2026-05-05: Removed scroll area wrappers from mods, resourcepacks, and shaderpacks tables.
- 2026-05-05: Added a shared `Table` scroll opt-out and used it on pack detail artifact lists.
- 2026-05-05: Validation passed for frontend, Sonata, release verification, and Rust check.
