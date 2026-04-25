# Change: pack-profile-manifests

- **Status**: proposed
- **Owner**: gisketch
- **Depends on**: m0-foundation

## Goal

Introduce pack-shipped `profiles/*.json` manifests for gameplay and sync presets, separate from the local launch-profile files already implemented.

## Motivation

- Current runtime only persists per-pack local launch settings under app data.
- Original product direction still expects repo-defined profiles with sync toggles and named Prism instances.
- OpenSpec needs a dedicated future change so baseline shipped behavior stays clean while profile-manifest work remains actionable.

## Scope

- Define `profiles/<name>.json` schema in the pack repo.
- Merge pack defaults with optional user-local overrides.
- Reintroduce profile-level sync toggles (`mods`, `configs`, `kubejs`, `resourcepacks`, `shaderpacks`, `keybinds`, `servers`).
- Let users choose among multiple named profiles per pack.

## Out of scope

- Reworking the existing local launch-profile JSON shape.
- Sync preview and partial merge work. Those track separately.

## Acceptance

- A pack can expose multiple named profiles from the repo.
- A user can select one profile per pack and persist local overrides.
- Sync and launch both honor the selected profile's toggles and Prism instance name.

## Tasks

- [ ] Define shipped-vs-user override precedence
- [ ] Implement repo profile loading and validation
- [ ] Add frontend profile selection UI
- [ ] Update sync/launch commands to accept selected profile
- [ ] Refresh OpenSpec baseline once shipped