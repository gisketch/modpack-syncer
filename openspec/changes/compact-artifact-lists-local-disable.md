# Change: compact-artifact-lists-local-disable

## Summary

Make pack detail artifact lists denser and add user-side disabling for instance artifacts.

## Requirements

1. Mods, resourcepacks, and shaderpacks lists MUST show compact single-line artifact rows without a separate filename line.
2. Each artifact list MUST include a search filter.
3. Each artifact list MUST paginate manifest entries with 15 entries per page.
4. Users MAY disable or enable resourcepacks and shaderpacks locally.
5. Users MAY disable or enable mods locally only when the manifest entry is optional.
6. Disabling an artifact MUST be user-side and apply to the Prism instance by renaming the artifact with a `.disabled` suffix.
7. Artifact list rows MUST show right-aligned `STATUS` and `ENABLED` controls instead of file size.
8. Disabled artifacts MUST be visually muted and struck through.
9. Artifact tables MUST support sorting by name, source, side, status, and enabled state from the table headers.
