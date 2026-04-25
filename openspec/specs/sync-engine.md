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
9. Current sync does not provide a dry-run preview and does not mutate `options.txt` or `servers.dat`.

## See

- [docs/architecture.md](../../docs/architecture.md) §3, §6, §8
