# Spec: profiles

Shipped per-pack local launch profiles.

This spec covers the launch-profile files modsync currently uses at runtime. Pack-shipped gameplay/sync profiles remain future work and are tracked separately as a change proposal.

## Requirements

1. A launch profile MUST be stored at `<appData>/launch-profiles/<packId>.json`.
2. If no launch-profile file exists for a pack, the app MUST synthesize a default profile with `minMemoryMb = 512`, `maxMemoryMb = 4096`, `extraJvmArgs = ""`, and `autoJava = true`.
3. If a preferred managed Java runtime already exists when the default profile is synthesized, the default profile MUST instead set `autoJava = false` and seed `javaPath` with that managed runtime.
4. A launch profile MUST expose `minMemoryMb`, `maxMemoryMb`, `javaPath` (optional), `extraJvmArgs`, and `autoJava`.
5. Saving a launch profile MUST update the local JSON file and the next sync or launch MUST apply those values to the Prism instance's `instance.cfg`.
6. When `autoJava` is `true`, modsync MUST not force a Java override into the Prism instance. When `autoJava` is `false` and `javaPath` is set, modsync MUST write that Java path into Prism's instance config.

## See

- [src-tauri/src/prism.rs](../../src-tauri/src/prism.rs)
- [src-tauri/src/paths.rs](../../src-tauri/src/paths.rs)
