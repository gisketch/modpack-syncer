# Spec: onboarding

First-run environment setup flow.

## Requirements

1. Onboarding completion MUST require all four gates: app storage confirmed, managed Java present, Prism location resolved, and offline username saved.
2. App storage settings MUST support either the default app data directory or a user-selected override directory. The confirmed choice MUST persist in app config.
3. Managed Java install MUST download an Adoptium runtime for the requested major version and image type, verify the package checksum, extract it under app data, and emit progress events during the install.
4. Managed Prism install MUST download the latest supported `PrismLauncher-Cracked` release asset, verify its published digest, extract it under app data, and save the resulting binary path and data directory as Prism overrides.
5. Clearing onboarding settings MUST reset saved Prism settings and remove managed Java runtimes for the requested major version. It does not need to delete previously downloaded managed launcher files.
6. Onboarding MAY be reopened from settings to re-run storage, Java, launcher, or username setup.

## See

- [src/routes/onboarding.tsx](../../src/routes/onboarding.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
- [src-tauri/src/paths.rs](../../src-tauri/src/paths.rs)