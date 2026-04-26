# Change: publish amend and builder dependencies

## Requirements

1. Publish preview MUST offer an `AMEND PREVIOUS UPDATE` mode before pushing.
2. Amend mode MUST apply current publish changes, reuse the current pack version, let the admin edit commit title/body, amend the previous publish commit, and push the rewritten branch.
3. Normal publish mode MUST continue to create a new commit and bump to the suggested next version.
4. Modpack Builder install dialog MUST inspect required Modrinth dependencies for the selected mod version.
5. Dependency preview MUST list required dependency projects, versions, filenames, and installed state.
6. Installing a mod with missing required dependencies selected MUST stage those dependency mods into the local Prism instance using the same SHA-verified Modrinth flow.
7. Modpack Builder MUST expose an admin-only manifest editor tab for deleting artifact entries and changing optional state.
8. Deleting a manifest artifact MUST remove the manifest entry, remove the local instance artifact, and remove the repo-owned artifact file when the entry source is `repo`.
9. Publish preview MUST surface uncommitted manifest and repo artifact edits created by the manifest editor as semantic rows, such as removed from mod list or now optional, instead of only a generic `manifest.json` row.
10. Pack detail mod status MUST show mods removed from the working manifest as deleted/removed even when comparing against the previous committed manifest.
11. Manifest editor MUST keep source-manifest entries that were deleted from the working manifest visible as strikethrough deleted rows. Entries that do not exist in the source manifest MAY disappear when deleted.
12. Sync MUST restore `manifest.json` from the current source commit before writing the Prism instance, so unpublished manifest editor deletions are reverted by sync.
13. Source-deleted manifest editor rows MUST provide a restore action that adds the entry back from the source manifest.
14. Publish scan MUST emit progress events with the current scan stage/path and completed/total scan step counts, and publish preview MUST show a progress bar while the scan is pending.
15. Sync progress MUST report post-download stages for resolving artifacts, writing instance files, applying options, and applying shader settings.