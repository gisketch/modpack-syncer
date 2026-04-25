# Spec: manifest

Authoritative description of the pack manifest (`manifest.json`) that lives at the root of every pack repo.

## Purpose

The manifest is the single source of truth for what a pack contains at a given commit. Consumers download it via `git` (libgit2) and resolve all other content from it.

## Requirements

1. **Schema version** — the manifest MUST include `schemaVersion` (integer). The app MUST reject manifests whose version it does not know.
2. **Pack metadata** — the manifest MUST include `pack.name`, `pack.version` (semver-ish), `pack.mcVersion`, `pack.loader` (`neoforge` | `fabric` | `forge` | `quilt`), and `pack.loaderVersion`. It MAY include `pack.icon` as an HTTPS URL for pack artwork.
3. **Entries** — `mods`, `resourcepacks`, and `shaderpacks` are arrays of entries. Each entry MUST have `id`, `source`, `filename`, `sha1`, and `size`.
4. **Supported sources** — `source` MUST be one of `modrinth`, `curseforge`, `url`, or `repo`.
5. **Remote entries** — entries with source `modrinth`, `curseforge`, or `url` MUST include `url`. They MAY also include `projectId`, `versionId`, `sha512`, `optional`, and `side`.
6. **Repo entries** — entries with source `repo` MUST include `repoPath`, resolved relative to the local pack clone. Repo entries MAY leave `url` empty.
7. **Integrity** — every artifact used for sync MUST be SHA1-verified before it is copied into the Prism instance. If `sha512` is present it MUST also match. This verification applies to freshly downloaded files, cache hits, and repo-backed entries.
8. **URL safety** — remote `url` hosts MUST be allowlisted. Current built-in hosts are `cdn.modrinth.com`, `edge.forgecdn.net`, and `mediafilez.forgecdn.net`.
9. **Resourcepack and shaderpack parity** — resourcepacks and shaderpacks MUST support the same remote Modrinth/CurseForge/URL and repo-source flow as mods. Resourcepack and shaderpack Modrinth version selection MUST NOT require a Minecraft loader match.

## See

- [docs/architecture.md](../../docs/architecture.md) §2.3
- [src-tauri/src/manifest.rs](../../src-tauri/src/manifest.rs)
