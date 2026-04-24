# Spec: sync-engine

Core pipeline that reconciles a local Prism instance's `.minecraft/` folder with the current pack manifest.

## Requirements

1. Sync MUST be idempotent. Running it twice in a row with no upstream changes MUST be a no-op.
2. Sync MUST only touch files listed in the manifest OR files under directories enabled by profile toggles (`configs/`, `kubejs/`, `resourcepacks/`, `shaderpacks/`). Unrelated user files MUST be preserved.
3. Sync MUST present a dry-run preview (added / removed / changed) before mutating the filesystem, unless the user has explicitly opted into auto-sync.
4. Mod jar downloads MUST be parallel, bounded by a concurrency cap (default 8), and MUST support resume via HTTP Range.
5. Every downloaded artifact MUST be SHA-verified before being linked/copied into the instance.
6. The local cache at `<data>/cache/<sha1>.jar` MUST be preferred over re-downloading; cache hits MUST still SHA-verify before use.
7. `options.txt` and `servers.dat` are NEVER clobbered wholesale. If `keybinds`/`servers` toggle is on, the app MUST do a partial merge (keybind lines / NBT server list entries only).

## See

- [docs/architecture.md](../../docs/architecture.md) §3, §6, §8
