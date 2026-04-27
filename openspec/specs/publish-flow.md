# Spec: publish-flow

Authoring and pack-publish behavior exposed by the app today.

## Requirements

1. Publish auth preferences MUST persist in `<appData>/publish-auth.json`. Personal access tokens MUST live only in the OS keychain, never in that JSON file.
2. Supported publish auth methods MUST be `ssh` and `pat`. SSH verification MUST check the SSH agent and standard private-key locations before declaring success.
3. Publish scan MUST compare the selected Prism instance against the local pack clone for these domains: `mods/`, `resourcepacks/`, `shaderpacks/`, `config/`, `kubejs/`, and root file `options.txt`.
4. Apply publish MUST copy changed artifact files into the pack repo, update `manifest.json`, and treat repo-owned binaries as `source = repo` entries with `repoPath` values rooted in the pack clone.
5. Apply publish MUST bump `manifest.pack.version` to the user-provided version or, if omitted, to the next patch version.
6. Commit and push MUST use libgit2 against the current branch, authenticate with the selected method, and fail if push does not complete within the command timeout.
7. Publish push timeout MUST allow long GitHub uploads up to 5 minutes before failing.
8. Publish push MUST emit progress events for staging, pack building, upload transfer, remote responses, and completion so the publish preview can show live progress, including an upload transfer rate when byte counts advance.
9. Publish preview scan MUST be metadata-only and MUST NOT hash file contents while opening Publish Preview.
10. Publish scan MUST emit stage progress for mods, resourcepacks, shaderpacks, config, shader settings, presets, kubejs, options, and done.
11. Publish Preview MAY offer a push-current-repo-only mode that skips instance apply and only commits/pushes current repository changes, for retries after files were already applied or instance files are locked by Windows.
12. Publish Preview MUST allow applying instance changes to the local pack repo without committing or pushing, so admins can inspect or push manually from the repository directory.
13. Apply publish SHOULD skip overwriting repository files that already match source content, retry transient Windows file lock errors when copying or removing files, and MUST include the affected path in the returned error if the lock persists.
14. Publish scan/apply MUST normalize instance artifact filenames ending in `.disabled` to their enabled filename before comparing, writing manifest entries, writing repo paths, or deciding removals.
15. Disabled instance mods MUST be treated as optional when publish apply repairs or creates their manifest entry.
16. Manifest Admin optional controls MUST remain interactive for active manifest entries and MUST normalize `.disabled` filenames before saving optional flags.
17. The authoring flow MAY resolve Modrinth metadata by identifier or project/version IDs and write those entries back into `manifest.json` as remote sources.

## See

- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/git.rs](../../src-tauri/src/git.rs)
- [src-tauri/src/keychain.rs](../../src-tauri/src/keychain.rs)