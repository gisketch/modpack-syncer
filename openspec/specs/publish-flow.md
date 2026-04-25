# Spec: publish-flow

Authoring and pack-publish behavior exposed by the app today.

## Requirements

1. Publish auth preferences MUST persist in `<appData>/publish-auth.json`. Personal access tokens MUST live only in the OS keychain, never in that JSON file.
2. Supported publish auth methods MUST be `ssh` and `pat`. SSH verification MUST check the SSH agent and standard private-key locations before declaring success.
3. Publish scan MUST compare the selected Prism instance against the local pack clone for these domains: `mods/`, `resourcepacks/`, `shaderpacks/`, `config/`, `kubejs/`, and root file `options.txt`.
4. Apply publish MUST copy changed artifact files into the pack repo, update `manifest.json`, and treat repo-owned binaries as `source = repo` entries with `repoPath` values rooted in the pack clone.
5. Apply publish MUST bump `manifest.pack.version` to the user-provided version or, if omitted, to the next patch version.
6. Commit and push MUST use libgit2 against the current branch, authenticate with the selected method, and fail if push does not complete within the command timeout.
7. The authoring flow MAY resolve Modrinth metadata by identifier or project/version IDs and write those entries back into `manifest.json` as remote sources.

## See

- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/git.rs](../../src-tauri/src/git.rs)
- [src-tauri/src/keychain.rs](../../src-tauri/src/keychain.rs)