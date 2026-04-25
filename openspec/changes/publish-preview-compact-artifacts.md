# Change: publish-preview-compact-artifacts

## Summary

Bring Publish Preview artifact tabs in line with the compact pack detail lists and expose mod optional flags.

## Requirements

1. Publish Preview mods, resourcepacks, and shaderpacks tabs MUST use compact single-line rows.
2. Publish Preview tabs MUST support search and 15-row pagination.
3. Publish Preview mod rows MUST expose an optional checkbox for mods already present in `manifest.json`.
4. Toggling the optional checkbox MUST update the matching manifest mod entry's `optional` field.
5. Publish Preview MUST support showing all manifest mods so unchanged published mods can be edited.
6. Publish scan and apply publish MUST ignore `.disabled` files.
