# Spec: launcher-integration

How modsync cooperates with Prism Launcher.

## Requirements

1. The app MUST NOT bundle Prism. It MUST detect an existing install.
2. Detection order: (a) user-configured path in settings, (b) platform defaults (`$XDG_DATA_HOME/PrismLauncher`, `%APPDATA%\PrismLauncher`, `~/Library/Application Support/PrismLauncher`), (c) `prismlauncher` on `$PATH`.
3. The app MUST write per-profile Prism instances under `<prismDataDir>/instances/<prismInstanceName>/` with a generated `instance.cfg` and `mmc-pack.json` that match the pack's MC version, loader, loader version, and Java path.
4. Microsoft auth is Prism's responsibility. The app MUST NOT collect Microsoft credentials.
5. Launch MUST spawn `prismlauncher --launch <prismInstanceName>` (or `-l`) and stream logs via Tauri log plugin.

## See

- [docs/architecture.md](../../docs/architecture.md) §5
- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
