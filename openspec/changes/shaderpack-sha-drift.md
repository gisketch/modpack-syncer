# Change: shaderpack-sha-drift

## Summary

Handle launcher-mutated shaderpack zip metadata without failing sync on same-name repo-backed shaderpacks.

## Requirements

1. Sync MAY tolerate SHA drift for repo-backed shaderpack `.zip` entries by trusting the same filename.
2. If the instance has an existing same-name shaderpack zip, sync MAY preserve/use that local file.
3. Apply publish MUST repair repo-backed shaderpack SHA/size when preserving same-name entries so future syncs stop seeing stale manifest hashes.
4. Options review MUST allow continue-to-sync without forcing users to open or decide shader settings.
