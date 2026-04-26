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
17. Pack detail MAY expose a full-page Modrinth builder. The builder MUST search Modrinth by current pack Minecraft version, MUST restrict mod results to the current pack loader, MUST paginate at 20 results, and MUST allow users to install any compatible project version into the local instance staging flow. Non-admin users MUST see that only admins can publish or update the pack source of truth. Already tracked or unpublished-staged Modrinth projects MUST be marked installed and MAY be changed to another compatible version.
18. Publish preview MUST offer an amend-previous-update mode that applies current changes, reuses the current pack version, allows editing commit title/body, amends the previous publish commit, and pushes the rewritten branch.
19. Modpack Builder mod installs MUST inspect required Modrinth dependencies for the selected version, list them in the install dialog, and allow missing required dependencies to be downloaded into the local staging flow with SHA verification.
20. Modpack Builder MUST expose an admin-only manifest editor tab. The editor MUST allow deleting artifact entries and changing optional state. Deleting an artifact MUST remove the manifest entry, remove the local instance artifact, and remove the repo-owned artifact file when the entry source is `repo`.
21. Publish preview MUST include uncommitted manifest and repo artifact changes produced by admin manifest editing as semantic rows, such as removed from mod list or now optional, instead of only a generic `manifest.json` row.
22. Pack detail mod status MUST show mods removed from the working manifest as deleted/removed based on comparison with the previous committed manifest.
23. Manifest editor MUST keep source-manifest entries that were deleted from the working manifest visible as strikethrough deleted rows. Entries that do not exist in the source manifest MAY disappear when deleted.
24. Sync MUST restore `manifest.json` from the current source commit before writing the Prism instance, so unpublished manifest editor deletions are reverted by sync.
25. Source-deleted manifest editor rows MUST provide a restore action that adds the entry back from the source manifest.
26. Publish scan MUST emit progress events while reading instance and repo folders, including the current scan stage/path and completed/total scan step counts, and the publish preview MUST show that progress while scan is pending.
27. Sync progress MUST continue after downloads into resolving artifacts, writing the Prism instance, applying options, and applying shader settings so the sync dialog remains informative during post-download work.

## See

- [src/routes/pack-detail.tsx](../../src/routes/pack-detail.tsx)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)
- [src-tauri/src/commands.rs](../../src-tauri/src/commands.rs)
- [src-tauri/src/git.rs](../../src-tauri/src/git.rs)
- [src-tauri/src/keychain.rs](../../src-tauri/src/keychain.rs)