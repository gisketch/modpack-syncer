# Spec: launcher-integration

How modsync resolves, provisions, configures, and launches Prism-compatible instances.

## Requirements

1. Launcher resolution MUST prefer saved overrides in `prism-settings.json`. If no saved override exists, the app MUST fall back to environment overrides (`PRISM_BIN`, `PRISM_DATA_DIR`), then platform-default install paths, then `$PATH` / Flatpak export lookup.
2. The app MAY install a managed `PrismLauncher-Cracked` build under app data. Managed install MUST verify the release asset digest before extraction and MUST persist the resulting binary path and data directory as saved overrides.
3. The app MUST write instances under `<prismDataDir>/instances/<instanceName>/` with generated `instance.cfg` and `mmc-pack.json` files derived from the manifest's Minecraft version, loader, loader version, and the active local launch profile.
4. The launch profile applied to an instance MUST control minimum memory, maximum memory, Java override path, and extra JVM arguments.
5. If an offline username is configured, launch MUST ensure a matching offline Prism account exists and MUST invoke Prism with `--offline <username>`. If an offline UUID is configured, that account MUST use the configured UUID; otherwise the app MUST keep using a deterministic offline UUID derived from the username.
6. The app MUST NOT collect Microsoft credentials. Microsoft authentication remains Prism's responsibility whenever offline launch is not being used.
7. Launch MUST execute the resolved Prism binary with `--launch <instanceName>`. If a saved Prism data-dir override exists, launch MUST also pass `--dir <dataDir>`. The app does not wait for Prism to exit after spawn.
8. If the current pack head differs from the last synced commit, launching from pack detail MUST show a sync-first gate with `SYNC NOW` and `CONTINUE ANYWAY` choices.
9. Pack detail artifact lists MUST support local user-side disabling by renaming instance artifacts with a `.disabled` suffix. Mods MAY only be disabled when their manifest entry is optional; resourcepacks and shaderpacks MAY be disabled by filename.
10. Artifact filenames ending in `.disabled` MUST render as disabled state using the enabled filename for display and toggle actions, and enabling them MUST remove a single `.disabled` suffix rather than appending another suffix.
11. Launching from pack detail MUST show preset selection before launcher options unless the user has chosen Don't Show Again for that pack. The preset selection MUST present Pack Default, Don't Override Settings, and pack presets as selectable expanded cards. The selected card MUST show description, disabled mods when present, and shader selected when present in preset Iris settings. If preset Iris settings set `enableShaders=false`, the card MUST show shaders disabled instead of the selected shader filename.
12. Launch MUST apply the selected preset before invoking Prism. Pack Default MUST apply pack baseline options and shader settings. Don't Override Settings MUST skip preset option keys, preset file overrides, and preset-disabled mods.
13. Pack detail MUST expose a Presets button for all users so preset selection remains available when the launch preset step is hidden.

## UI Requirements

1. Settings and onboarding MUST expose offline username and optional offline UUID fields through existing `src/components/ui` primitives. Invalid UUID input MUST block save.
2. Pack detail artifact lists for mods, resourcepacks, and shaderpacks MUST be compact, searchable, and paginated to 15 manifest entries per page.
3. Artifact list rows MUST display clean artifact names without a second filename line; the full filename MAY remain available as hover/title text.
4. Artifact list rows MUST align status on the right and expose an `ENABLED` checkbox; checked means the instance artifact is active, unchecked means it is renamed with `.disabled`.
5. Disabled artifact rows MUST be visually muted and struck through. Non-optional mods MUST show a disabled checked `ENABLED` control.
6. Pack detail artifact table data headers MUST sort their table when clicked and MUST show fixed-size direction icons without changing header layout.

## See

- [docs/architecture.md](../../docs/architecture.md) §5
- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
