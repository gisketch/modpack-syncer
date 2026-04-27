# Spec: sync-engine

Core pipeline that reconciles a local Prism instance's `.minecraft/` folder with the current pack manifest.

## Requirements

1. Sync MUST load the pack manifest from the local git clone at `<appData>/packs/<packId>/manifest.json` and MUST fail fast on unsupported manifest schema.
2. Remote manifest entries (`modrinth`, `curseforge`, `url`) MUST download through the bounded parallel pipeline with concurrency cap `8`.
3. The local cache at `<data>/cache/<sha1>.jar` MUST be preferred over re-downloading, and cache hits MUST still pass artifact verification before use.
4. Repo-backed manifest entries (`source = repo`) MUST resolve from `repoPath` inside the local pack clone and MUST exist before instance write begins.
5. Sync MUST abort before instance mutation if any required remote artifact fails to download or verify.
6. Sync MUST write generated Prism metadata (`instance.cfg`, `mmc-pack.json`) and managed content into `.minecraft/mods`, `.minecraft/resourcepacks`, and `.minecraft/shaderpacks`.
7. Sync MUST only replace files it manages inside mods/resourcepacks/shaderpacks and MUST preserve unrelated user files in those directories.
8. Sync MUST merge pack-owned text trees by copying `overrides/` into `.minecraft/`, `configs/` into `.minecraft/config/`, and `kubejs/` into `.minecraft/kubejs/`.
9. Sync review MUST provide a pre-sync preview grouped by mods, resourcepacks, shaderpacks, and options review.
10. Options review MUST diff pack `options.txt` against instance `options.txt`, group rows into keybinds, video settings, and all other options, and allow per-key ignore state.
11. Ignored option keys MUST persist per instance and MUST remain visible when the user enables the ignored-row toggle.
12. Shader settings review MUST live as a separate tab inside options review. It MUST diff pack `configs/iris.properties` against instance `config/iris.properties` and MUST diff the active shader preset sidecar `shaderpacks/<shaderPack>.txt` when present.
13. Shader settings review MUST expose an explicit `IGNORE SHADER SETTINGS` control when shader settings differ. When ignore is off, sync MUST copy pack `configs/iris.properties` to instance `config/iris.properties` and copy the matching shader preset sidecar when present. When ignore is on, sync MUST leave shader settings unchanged.
14. Sync MUST support remote and repo-backed entries across mods, resourcepacks, and shaderpacks with the same SHA verification rules.
15. Pack repos MAY include preset JSON files under `presets/`. Each preset MUST be a bundle over selected option keys, selected file overrides, and selected disabled mod filenames.
16. Publisher preset capture MUST read the current Prism instance and default to including video option keys while leaving keybinds and other option keys unselected until the publisher opts in.
17. Publisher preset capture MUST expose selectable file overrides from `config/**` and `shaderpacks/*.txt`; saved preset file bytes MUST live under `presets/<presetId>/files/<relativePath>`.
18. Publisher preset capture MUST expose optional manifest mods so the publisher can mark mods disabled for that preset. Sync MUST apply disabled mod states by renaming selected mods to `<filename>.disabled` after writing the instance.
19. Publisher preset builder MUST live under the Builder page's Presets tab. It MUST present separate searchable sections for video settings, keybinds, other options, config/shader sidecar file overrides, and optional mods, and MUST allow publishers to load and edit existing presets.
20. Sync review MUST use this wizard order: sync preview, keybinds/options review, then sync progress after confirmation.
21. Sync MUST apply pack-default option and shader settings only. Preset selection MUST happen in the launch flow, not the sync flow.
22. Pack Default MUST pull from the pack's main source files rather than any preset. Don't Override Settings MUST select no preset and skip preset option keys, preset file overrides, and preset-disabled mods.
23. Launch MUST apply selected preset keys after synced pack defaults, MUST only modify keys included in the preset, and MUST let per-key ignored option state override preset option keys.
24. Launch MUST copy selected preset file overrides into the Prism instance before Prism starts.
25. `IGNORE SHADER SETTINGS` MUST override sync-time pack shader settings only. Launch-time preset file overrides are preset-owned and apply when a preset is selected.
26. The pack detail UI MUST consider an instance needing sync when the last synced pack commit differs from the current local pack head, even if current artifact files look unchanged.
27. Local option file edits MUST be handled through options review and ignored-key controls, not treated as a global pack-update signal by themselves.
28. Options review MUST let users enable or disable syncing for each options category (`keybinds`, `video`, `other`). Category sync MUST be enabled by default, and disabled categories MUST leave matching local option keys unchanged during sync.
29. Repo-backed shaderpack zip entries MAY tolerate SHA drift by filename, because launchers can rewrite shaderpack zip metadata after opening the shaderpack. If the existing instance already has the same shaderpack filename, sync MAY preserve that same-name local file instead of failing SHA verification.
30. Options review MUST allow users to continue to sync without visiting or deciding the shader settings tab; an undecided shader settings state MUST behave like not syncing shader settings.
31. Pack fetch MUST force-align the local pack clone to the fetched remote head when remote history has been rewritten and fast-forward is impossible. Pack fetch MUST also remove untracked local files so stale local-only pack files, including presets, do not merge with source repo files.
32. If a previously selected option preset is no longer present in the pack repo, options preview and sync MUST fall back to Pack Default instead of failing on the missing preset file.

## See

- [docs/architecture.md](../../docs/architecture.md) §3, §6, §8
- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
