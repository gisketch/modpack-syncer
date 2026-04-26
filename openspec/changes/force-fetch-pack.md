# Change: force-fetch-pack

## Summary

Make pack fetch recover from remote history rewrites by force-aligning the local clone to the fetched remote head when a fast-forward is not possible.

## Requirements

1. Fetch MUST still fast-forward when possible.
2. Fetch MUST hard reset the local pack clone to the fetched remote head when histories diverge.
3. Fetch MUST return the resulting local head SHA after the reset.
