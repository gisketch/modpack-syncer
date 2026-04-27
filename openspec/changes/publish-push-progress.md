# Change: publish-push-progress

## Summary

Make long publish pushes observable and less likely to fail on large uploads.

## Requirements

1. Publish push MUST allow up to 5 minutes before timeout.
2. Publish push MUST report staging, pack building, upload, remote, done progress, and upload transfer rate when byte counts advance.
3. Publish Preview MUST show live push progress while commit/amend/push is running.
4. Amend previous publish MUST force-push the current branch through libgit2.
5. Publish scan MUST avoid SHA hashing and use metadata-only comparison for preview speed.
6. Publish Preview MUST show live scan stage progress while reading instance/repo files.
7. Publish Preview MAY let admins skip instance apply and push current repo changes only.
8. Apply publish SHOULD skip same-content overwrites and retry transient Windows file lock errors before failing with path context.
9. Publish Preview MUST offer an apply-only action that writes local repo changes without commit/push.
10. Publish scan/apply MUST treat `.disabled` as instance state, normalize artifact filenames to their enabled form, and preserve disabled mods as optional manifest entries.
11. Manifest Admin optional controls MUST be clickable for active entries and save against normalized enabled filenames.