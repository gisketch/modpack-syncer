# Admin Mode Test Guide

Use this checklist to validate admin-mode behavior end to end.

## Preconditions

1. Install Prism Launcher and create linked instance `modsync-<pack-id>`.
2. Open a pack that already has a valid `manifest.json`.
3. Keep one test repo remote available for push validation.

## Case 1: Admin mode gate

1. Open Settings.
2. Disable `ADMIN MODE`.
3. Open pack detail page.
4. Confirm `PUBLISH` button is hidden.
5. Re-enable `ADMIN MODE`.
6. Confirm `PUBLISH` button appears without app restart.

## Case 2: Publish auth with PAT

1. In Settings, choose `PAT`.
2. Save valid GitHub PAT.
3. Confirm status line shows `PAT PRESENT`.
4. Clear PAT.
5. Confirm status line shows `PAT MISSING`.
6. Save PAT again for later tests.

Expected:

- PAT stores outside repo files.
- No token appears in UI after save.

## Case 3: Publish auth with SSH

1. In Settings, choose `SSH`.
2. Ensure remote uses SSH URL.
3. Test once with key loaded in `ssh-agent`.
4. Test once with agent empty but usable key in `~/.ssh/`.

Expected:

- Push succeeds with agent-loaded key.
- Push also succeeds with fallback key from `~/.ssh/`.
- Encrypted key without agent should fail cleanly.

## Case 4: Preview detects all artifact classes

1. Add one mod jar under `.minecraft/mods`.
2. Add one resourcepack zip under `.minecraft/resourcepacks`.
3. Add one shaderpack zip under `.minecraft/shaderpacks`.
4. Change one file under `.minecraft/config`.
5. Change one file under `.minecraft/kubejs`.
6. Change `options.txt` at instance root.
7. Remove one tracked file from any managed category.
8. Click `PUBLISH`.

Expected:

- Preview lists `add`, `update`, `remove`, and `unchanged` rows.
- Categories show `MODS`, `RESOURCEPACKS`, `SHADERPACKS`, `CONFIG`, `KUBEJS`, and `ROOT` when present.

## Case 5: Apply only

1. Run preview with pending changes.
2. Click `APPLY TO REPO`.
3. Inspect pack repo working tree.

Expected:

- New local binaries copied to repo category folders.
- Changed config and kubejs files copied into repo tree.
- Removed repo-backed artifacts deleted.
- `manifest.json` updates hashes, sizes, and repo paths.
- Existing unchanged remote-source entries stay remote when possible.

## Case 6: Commit and push

1. Run preview with pending changes.
2. Enter custom commit message.
3. Click `COMMIT + PUSH`.
4. Inspect remote branch.

Expected:

- Preview changes re-apply before commit.
- New commit appears on current branch.
- Toast shows commit SHA prefix and auth method.
- Remote branch matches local working tree after push.

## Case 7: No-change publish

1. Sync repo and instance until preview shows only `unchanged`.
2. Run `PUBLISH` again.
3. Click `COMMIT + PUSH`.

Expected:

- No duplicate content changes written.
- Existing branch push remains safe.
- No manifest corruption.

## Case 8: Failure handling

1. Remove Prism instance and run `PUBLISH`.
2. Select `PAT` mode with no saved token, then push.
3. Select wrong remote protocol for chosen auth mode.
4. Use encrypted SSH key without agent.

Expected:

- Missing instance returns clear error.
- Missing PAT returns clear error.
- Auth mismatch returns git credential error.
- App stays responsive and does not close dialog unexpectedly.

## Case 9: Post-publish sync validation

1. After successful apply or push, reload pack detail page.
2. Re-run `FETCH` if remote changed.
3. Re-run `SYNC`.
4. Check mod status table.

Expected:

- Newly published repo-backed files show `synced` after instance write.
- Removed files no longer show as tracked manifest entries.
- Deleted stale files remain muted instead of red.