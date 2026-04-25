# Change: sync-launch-gate

## Summary

Use last-synced commit state as the primary pack update signal and gate launch when the instance is behind the current pack head.

## Requirements

1. Pack detail MUST mark sync as needed when the local pack head differs from the last synced commit.
2. Sync CTA SHOULD use the primary button style when sync is needed.
3. Launch SHOULD show a sync-first dialog when the pack is behind, with `SYNC NOW` and `CONTINUE ANYWAY` actions.
4. Changelog highlight SHOULD only appear when the last synced commit differs from the current pack head.
5. Local option edits SHOULD remain scoped to options review and ignored-key decisions to avoid false global unsynced warnings from Minecraft-generated file churn.
