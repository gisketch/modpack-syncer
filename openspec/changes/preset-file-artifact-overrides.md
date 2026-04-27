# Change: preset-file-artifact-overrides

## Summary

Extend pack presets from option-key patches into one user-facing preset bundle that can own option keys, selected config/shader sidecar files, and disabled mod states.

## Requirements

1. Publisher preset capture MUST include selected option keys from `options.txt`.
2. Publisher preset capture MUST let publishers select file overrides from `config/**` and `shaderpacks/*.txt`.
3. Saved preset file overrides MUST be copied into `presets/<presetId>/files/<relativePath>` and referenced by preset JSON.
4. Publisher preset capture MUST let publishers search optional manifest mods and mark them disabled for the preset.
5. Sync MUST copy selected preset file overrides after standard pack overrides and shader settings sync.
6. Sync MUST rename preset-disabled mods to `<filename>.disabled` after writing managed mods.
7. Sync review MUST present preset choice before options preview so users understand which preset controls the upcoming option/file/mod changes.
8. Publisher preset builder MUST show searchable sections for video settings, keybinds, other options, config/shader files, and optional mods.
9. Sync review MUST show a dedicated Choose Preset step between artifact preview and keybinds/options review.
10. Choose Preset MUST include a Don't Override Settings option that skips preset-owned option keys, file overrides, and disabled mods.
