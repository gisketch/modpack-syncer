# Change: drop-minio

- **Status**: proposed
- **Owner**: gisketch
- **Depends on**: m0-foundation
- **Supersedes parts of**: M3 milestone (MinIO integration)

## Goal

Remove MinIO/S3 from the product scope. All pack data (manifest + text) lives in Gitea; all binary assets (mod jars, resourcepacks, shaderpacks) come from upstream CDNs (Modrinth / CurseForge). Custom private assets are out of scope for v1; if needed later, we'll reopen as a new change.

## Motivation

- Simpler VPS setup for the owner (one service to run: Gitea).
- Smaller blast radius: no S3 creds to manage, no extra allowlist hosts, no object lifecycle concerns.
- Friends installing the app only need a public Gitea URL — no object-store credentials to distribute.
- Author-mode (M4) becomes git-only: commit manifest + configs, push via PAT. No upload pipeline.

## Scope

1. **Docs**
   - `docs/architecture.md`: remove MinIO from storage layers table, data flow diagrams, tech stack, security, roadmap, and sync tables.
   - `docs/architecture.md` §2.2: drop `assets-manifest.json` from example repo layout.
   - `docs/architecture.md` §2.3: remove `"minio"` from the `source` enum documentation.
   - `docs/planned_features.md`: delete `## M3 — MinIO / custom assets` section wholesale; renumber later milestones only where referenced (keep M4+ labels stable to avoid churn); remove MinIO mentions from M4, M7, Security, and Docs sections.
2. **Code**
   - `src-tauri/src/manifest.rs`: remove `Source::Minio` variant. Allowed sources now: `Modrinth | Curseforge | Url`.
   - `src-tauri/Cargo.toml`: remove `aws-sdk-s3` and its transitive S3 config crates; remove the `# S3 / MinIO` comment header.
   - `src-tauri/Cargo.toml`: update keychain comment to just "Gitea PAT" (no MinIO keys).
3. **Spec**
   - `openspec/specs/manifest.md`: remove `minio` from the source enum.
   - `openspec/config.yaml`: remove the `object_storage: minio` line (or replace with `object_storage: none`).
4. **Repo instructions**
   - `.github/copilot-instructions.md`: drop MinIO mentions (secrets line + manifest-reference line).

## Out of scope

- Any replacement for private/custom assets. If later needed, open a new change (e.g. `add-private-assets`) and pick a simpler path (e.g. hosting jars directly in Gitea LFS, or a plain HTTPS directory with allowlisted host).

## Acceptance

- `grep -iR "minio\|aws-sdk-s3\|assets-manifest" docs src-tauri src openspec .github` returns no matches (except inside this change file and any archived historical changes).
- `cargo check` in `src-tauri` passes.
- `cargo test` in `src-tauri` passes.
- `bun run typecheck` and `bun run lint` pass.
- Architecture doc's storage table has exactly 3 rows (Gitea, CDN, Local SQLite).

## Tasks

- [ ] Scrub `docs/architecture.md` of all MinIO references
- [ ] Scrub `docs/planned_features.md` (delete M3 section + inline mentions)
- [ ] Remove `Source::Minio` from `src-tauri/src/manifest.rs`
- [ ] Remove `aws-sdk-s3` dep from `src-tauri/Cargo.toml`
- [ ] Update `openspec/specs/manifest.md` source enum
- [ ] Update `openspec/config.yaml` (`object_storage`)
- [ ] Update `.github/copilot-instructions.md`
- [ ] Run `cargo check`, `cargo test`, `bun run typecheck`, `bun run lint`
- [ ] Commit: `refactor: drop MinIO from scope — git-only backing store`

## Migration notes

- No user migration needed: no one has a deployed pack using MinIO yet.
- Any existing dev `manifest.json` files that reference `"source": "minio"` will now fail to parse — this is intentional; there are none in the wild.
