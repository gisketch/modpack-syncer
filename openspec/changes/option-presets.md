# Change: Option Presets

## Summary

Add pack-owned option presets that publishers can capture from a Prism instance and users can choose during sync. Presets are patch files: they only apply keys explicitly included in the preset.

## Requirements

1. Pack repos MAY contain option preset JSON files under `presets/`.
2. Each preset MUST have a stable `id`, display `label`, optional `description`, option-key maps grouped by `video`, `keybinds`, and `other`, and optional shader maps for Iris properties and shader preset sidecar values.
3. Publisher preset capture MUST read from the selected Prism instance and default to including video and shader settings while leaving keybinds and other options unselected.
4. Publisher preset save MUST write only selected keys to `presets/<id>.json` in the pack repo.
5. Sync review MUST let users choose `Pack Default`, `None`, or any pack preset before confirming options sync.
6. Selected presets MUST affect the options and shader preview before sync.
7. Sync MUST apply selected preset keys after pack defaults and MUST only modify keys included in the preset.
8. Per-key ignored option state MUST override selected preset option keys.
9. `IGNORE SHADER SETTINGS` MUST override the shader portion of a selected preset.
