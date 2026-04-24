# Spec: profiles

Per-user, per-pack run configuration.

## Requirements

1. A profile MUST be a JSON file under `profiles/<name>.json` in the pack repo, OR a user-local override at `<appdata>/modsync/profiles/<pack>.<name>.json`.
2. User-local overrides MUST win over pack-shipped profile values.
3. Each profile has toggles: `mods`, `configs`, `kubejs`, `resourcepacks`, `shaderpacks`, `keybinds`, `servers`. Default = `true` for the first five, `false` for `keybinds` and `servers`.
4. Each profile has `java.version` (u32), `java.xms`, `java.xmx`, optional `java.extraArgs`.
5. Each profile MUST map 1:1 to a Prism instance name via `prismInstanceName`.

## See

- [docs/architecture.md](../../docs/architecture.md) §2.4, §6
- [src-tauri/src/profile.rs](../../src-tauri/src/profile.rs)
