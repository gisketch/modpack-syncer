# Spec: launcher-integration

How modsync resolves, provisions, configures, and launches Prism-compatible instances.

## Requirements

1. Launcher resolution MUST prefer saved overrides in `prism-settings.json`. If no saved override exists, the app MUST fall back to environment overrides (`PRISM_BIN`, `PRISM_DATA_DIR`), then platform-default install paths, then `$PATH` / Flatpak export lookup.
2. The app MAY install a managed `PrismLauncher-Cracked` build under app data. Managed install MUST verify the release asset digest before extraction and MUST persist the resulting binary path and data directory as saved overrides.
3. The app MUST write instances under `<prismDataDir>/instances/<instanceName>/` with generated `instance.cfg` and `mmc-pack.json` files derived from the manifest's Minecraft version, loader, loader version, and the active local launch profile.
4. The launch profile applied to an instance MUST control minimum memory, maximum memory, Java override path, and extra JVM arguments.
5. If an offline username is configured, launch MUST ensure a matching offline Prism account exists and MUST invoke Prism with `--offline <username>`.
6. The app MUST NOT collect Microsoft credentials. Microsoft authentication remains Prism's responsibility whenever offline launch is not being used.
7. Launch MUST execute the resolved Prism binary with `--launch <instanceName>`. If a saved Prism data-dir override exists, launch MUST also pass `--dir <dataDir>`. The app does not wait for Prism to exit after spawn.
8. If the current pack head differs from the last synced commit, launching from pack detail MUST show a sync-first gate with `SYNC NOW` and `CONTINUE ANYWAY` choices.

## See

- [docs/architecture.md](../../docs/architecture.md) §5
- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
