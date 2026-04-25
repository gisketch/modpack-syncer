# Change: publish-ignore

## Summary

Add app-local publish ignore patterns for admins so selected instance/repo files are excluded from publish preview and apply.

## Requirements

1. Publish ignore patterns MUST persist in app state per pack.
2. Publish scan MUST omit files matched by the pack's ignore patterns.
3. Apply publish MUST preserve ignored repo/manifest entries and MUST NOT copy, remove, or add ignored files.
4. Publish preview SHOULD let admins toggle ignored state on listed rows and show or hide ignored rows in-place.
