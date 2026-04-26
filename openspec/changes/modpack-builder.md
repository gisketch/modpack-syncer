# Change: modpack-builder

## Summary

Add a full-page Modrinth-backed modpack builder for adding compatible mods, resourcepacks, and shaderpacks to a pack instance.

## Requirements

1. The builder MUST be accessible from a pack detail page for admin users.
2. The builder MUST provide tabs for mods, resourcepacks, and shaderpacks.
3. Builder search MUST query Modrinth with the current pack Minecraft version and MUST restrict mod results to the current pack loader.
4. Builder search MUST paginate results at 20 projects per page.
5. Builder search MUST provide text search, sort, and side filters.
6. Each project result MUST allow selecting any compatible Modrinth version before installing.
7. Installing from the builder MUST download the selected project version into the Prism instance and reuse the existing Modrinth publish staging flow.
8. Project result rows MUST expose one primary action: `INSTALL`, or `CHANGE VERSION` when already tracked.
9. The install action MUST open a dialog containing the compatible version dropdown and side selector.
10. Non-admin users MAY browse and install local candidates from the builder, but MUST see messaging that only admins can publish or update the pack source of truth.
11. Changing version for an already tracked Modrinth project MUST remove the previous instance artifact before staging the selected compatible version.
12. Search results MUST mark projects already staged in unpublished Modrinth state as installed, even before they are published into the manifest.
