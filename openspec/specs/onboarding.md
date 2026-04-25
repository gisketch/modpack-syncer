# Spec: onboarding

First-run environment setup flow.

## Requirements

1. Onboarding completion MUST require these gates: default install directory selected, managed Java present, Prism location resolved, and offline username saved. Pack cloning happens after onboarding on the Packs page.
2. Managed Java install MUST download an Adoptium runtime for the requested major version and image type, verify the package checksum, extract it under app data, and emit progress events during the install.
3. Managed Prism install MUST download the latest supported `PrismLauncher-Cracked` release asset, verify its published digest, extract it under app data, and save the resulting binary path and data directory as Prism overrides.
4. Offline username MUST persist through Prism settings so offline launch can create/use a matching Prism offline account.
5. Clearing onboarding settings MUST reset saved Prism settings and remove managed Java runtimes for the requested major version. It does not need to delete previously downloaded managed launcher files.
6. Onboarding MAY be reopened from settings to re-run Java, launcher, username, or pack setup.
7. Onboarding MUST be presented as a step-by-step window flow with a segmented progress indicator, not as one long scrolling page.
8. The default install directory MUST control where managed Java runtimes, managed launchers, and cloned modpacks are stored.
9. Completing the username step MUST route users to the Packs page.

## See

- [src/routes/onboarding.tsx](../../src/routes/onboarding.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
- [src-tauri/src/paths.rs](../../src-tauri/src/paths.rs)