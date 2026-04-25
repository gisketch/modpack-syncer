# Change: sync-preview-and-partial-merge

- **Status**: proposed
- **Owner**: gisketch
- **Depends on**: m0-foundation

## Goal

Add a true sync preview step plus partial merge behavior for user-owned files that should not be overwritten wholesale.

## Motivation

- Current sync applies changes directly once downloads succeed.
- `options.txt` and `servers.dat` still need special-case handling to preserve personal settings and servers.
- Original baseline spec promised these behaviors, but code has not shipped them yet.

## Scope

- Compute a dry-run report before filesystem mutation.
- Add explicit user confirmation flow for apply.
- Implement keybind-only merge for `options.txt`.
- Implement NBT-aware merge for `servers.dat`.

## Out of scope

- General-purpose three-way merge for all config files.
- Pack profile manifests.

## Acceptance

- Sync can render added, removed, and changed items before apply.
- Applying sync preserves unrelated user content in `options.txt` and `servers.dat`.
- Auto-sync, if later added, can bypass preview only with explicit user opt-in.

## Tasks

- [ ] Define preview payload shape
- [ ] Add frontend preview/confirm UI
- [ ] Implement `options.txt` partial merge
- [ ] Implement `servers.dat` partial merge
- [ ] Update OpenSpec baseline once shipped