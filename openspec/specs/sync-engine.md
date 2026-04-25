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

## See

- [docs/architecture.md](../../docs/architecture.md) §3, §6, §8
- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
