# Change: Modrinth artifact admin add flow

## Summary

Pack detail admin mode now supports staging Modrinth content into three manifest artifact categories:

- `mods`
- `resourcepacks`
- `shaderpacks`

The add flow keeps same staged-before-publish model used for mods:

1. Resolve a Modrinth project/version from link, slug, or project id.
2. Download artifact into the linked Prism instance directory for that category.
3. Preserve Modrinth metadata locally until publish.
4. On publish, write manifest entries with `source = modrinth` instead of degrading staged resourcepacks/shaderpacks into `source = repo`.

## UI expectations

- Pack detail page shows dedicated `RESOURCEPACKS` and `SHADERPACKS` sections.
- Admin mode exposes `ADD RESOURCEPACK` and `ADD SHADERPACK` buttons beside existing mod add flow.
- Add dialog reuses same Modrinth resolve preview used by mods, with category-specific copy.

## Non-goals

- No new player preset sync behavior in this change.
- No generic arbitrary root-file add flow in this change.
- No `servers.dat` or `options.txt` merge behavior in this change.