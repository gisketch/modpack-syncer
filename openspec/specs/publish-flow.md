# Spec: publish-flow

Authoring and pack-publish behavior exposed by the app today.

## Requirements

1. Publish auth preferences MUST persist in `<appData>/publish-auth.json`. Personal access tokens MUST live only in the OS keychain, never in that JSON file.
2. Supported publish auth methods MUST be `ssh` and `pat`. SSH verification MUST check the SSH agent and standard private-key locations before declaring success.
3. Publish scan MUST compare the selected Prism instance against the local pack clone for these domains: `mods/`, `resourcepacks/`, `shaderpacks/`, `config/`, `kubejs/`, root file `options.txt`, shader settings, and repo-owned option presets under `presets/`.
4. Apply publish MUST copy changed artifact files into the pack repo, update `manifest.json`, and treat repo-owned binaries as `source = repo` entries with `repoPath` values rooted in the pack clone.
5. Apply publish MUST bump `manifest.pack.version` to the user-provided version or, if omitted, to the next patch version.
6. Commit and push MUST use libgit2 against the current branch, authenticate with the selected method, and fail if push does not complete within the command timeout.
7. The authoring flow MAY resolve Modrinth metadata by identifier or project/version IDs for mods, resourcepacks, and shaderpacks and write those entries back into `manifest.json` as remote sources.
8. Publish preview MUST categorize changes into tabs for mods, shaderpacks, resourcepacks, configs, options, shader settings, option presets, and other files.
9. Shader settings publish MUST treat `config/iris.properties` from the instance as pack `configs/iris.properties` and shader preset sidecars as `shaderpacks/*.txt`. These files MUST NOT be treated as generic config rows or shaderpack artifact entries.
10. Unpublished local status rows MUST include staged local mods, resourcepacks, and shaderpacks before publish commits them into the manifest.
11. Admin publish preview MUST support app-local ignore patterns per pack. Ignored files MUST be omitted from publish scan output and MUST NOT be copied, removed, committed, or written into `manifest.json` during apply publish.
12. Apply publish MUST repair repo-backed shaderpack manifest SHA/size when preserving a same-name shaderpack entry, using an existing valid repo zip or copying the same-name instance zip if the repo copy is empty or invalid.
13. Publish preview artifact tabs for mods, resourcepacks, and shaderpacks MUST use compact searchable paginated lists consistent with pack detail artifact lists.
14. Publish preview mod rows MUST allow admins to mark existing manifest mods optional or required. This control MUST update the mod entry's `optional` field in `manifest.json`.
15. Publish preview MUST provide a show-all-mods mode so unchanged manifest mods can be displayed and edited for optional status.
16. Publish scan and apply publish MUST ignore local files ending with `.disabled`.

## See

- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/git.rs](../../src-tauri/src/git.rs)
- [src-tauri/src/keychain.rs](../../src-tauri/src/keychain.rs)