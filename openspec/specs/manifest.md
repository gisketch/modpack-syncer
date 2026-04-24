# Spec: manifest

Authoritative description of the pack manifest (`manifest.json`) that lives at the root of every pack repo.

## Purpose

The manifest is the single source of truth for what a pack contains at a given commit. Consumers download it via `git` (libgit2) and resolve all other content from it.

## Requirements

1. **Schema version** — the manifest MUST include `schemaVersion` (integer). The app MUST reject manifests whose version it does not know.
2. **Pack metadata** — the manifest MUST include `pack.name`, `pack.version` (semver-ish), `pack.mcVersion`, `pack.loader` (`neoforge` | `fabric` | `forge` | `quilt`), and `pack.loaderVersion`.
3. **Entries** — `mods`, `resourcepacks`, `shaderpacks` are each arrays of entries. Each entry MUST have `id`, `source` (`modrinth` | `curseforge` | `url`), `filename`, `sha1`, `size`, `url`. `sha512`, `projectId`, `versionId`, `optional`, `side` are optional.
4. **Integrity** — every downloaded artifact MUST be SHA1-verified before being written to the instance. If `sha512` is present it MUST also match.
5. **URL safety** — the app MUST validate `url` host against an allowlist: `cdn.modrinth.com`, `edge.forgecdn.net`, `mediafilez.forgecdn.net`.

## See

- [docs/architecture.md](../../docs/architecture.md) §2.3
- [src-tauri/src/manifest.rs](../../src-tauri/src/manifest.rs)
