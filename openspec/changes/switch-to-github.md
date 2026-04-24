# Change: switch-to-github

- **Status**: proposed
- **Owner**: gisketch
- **Depends on**: drop-minio
- **Supersedes**: `docs/vps-setup.md` (Gitea) — to be deleted

## Goal

Swap the pack's source of truth from self-hosted Gitea to **GitHub (public repo)**. No VPS needed for hosting the pack; admin pushes via normal GitHub workflow; friends clone anonymously from the public repo URL.

## Motivation

- Zero VPS setup or maintenance for the owner.
- Free for public repos, generous bandwidth on git clone/fetch.
- Friends need no Gitea account, no host-specific trust; GitHub URLs are already trusted by `git2` / libgit2.
- GitHub's SSH + PAT story is well-known; onboarding new authors (future) is easier.
- Better uptime than a single-node VPS.

## Assumptions

- The pack repo will be **public** on GitHub (e.g. `https://github.com/gisketch/modsync-pack`). If a pack ever needs to be private, we'll open a separate change to handle PAT-gated clone in the app.
- Admin still uses the same flow as with Gitea (SSH key or PAT for push).
- In-app publish (M3) will later support GitHub PATs in the keychain; the wire protocol (libgit2 + HTTPS basic auth) is identical to Gitea, so no code change is forced at this point.

## Scope

### Docs
- `docs/architecture.md` — replace "Gitea" with "GitHub" in storage-layer table, data-flow diagrams, security section. Remove the "self-hosted, user VPS" qualifier.
- `docs/planned_features.md` — rewrite the `docs/vps-setup.md` checklist line into `docs/github-setup.md` (or drop entirely if a README subsection suffices).
- **Delete** `docs/vps-setup.md` (it was Gitea-specific, now obsolete).
- **Add** `docs/github-setup.md` — short guide: create public repo, add first commit, generate PAT (for future in-app push), friend-clone URL example.

### OpenSpec
- `openspec/config.yaml`: `git_host: gitea` → `git_host: github`.
- `openspec/specs/manifest.md` — any Gitea mentions become "git host".

### Code
- `src-tauri/src/commands.rs` — placeholder URL in any sample / comment should reference `github.com/…`.
- `src-tauri/src/git.rs` — no logic change needed (libgit2 handles github fine); only update doc comments that mention Gitea.
- `src/routes/home.tsx` — change the Add-pack input `placeholder` from the Gitea example to `https://github.com/gisketch/modsync-pack.git`.
- `.github/copilot-instructions.md` — swap Gitea for GitHub in the secrets / project description lines.

### Host allowlist (manifest URL safety)
- **No change.** The URL allowlist is for **mod download URLs** (Modrinth / CurseForge CDN), not for the git repo URL. Git repo URL is trusted as whatever the user pastes.

### Things that stay the same
- `git2` dependency (libgit2 already speaks GitHub over HTTPS).
- Manifest schema.
- Download pipeline.
- Prism integration.
- Author-mode M3 plan (just points at GitHub's API + PAT instead of Gitea's).

## Out of scope

- GitHub API integration (issues, releases, auto-release on tag push). Nice-to-have, open later.
- Private-repo clone support in the app. Open later if needed.
- Migration tooling from an existing Gitea repo — assume none deployed yet (true for this project).

## Acceptance

- `grep -rni --exclude-dir=target --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=changes "gitea" docs src-tauri/src src openspec .github` returns no matches.
- `docs/vps-setup.md` does not exist.
- `docs/github-setup.md` exists with: create-repo steps, push setup (SSH or PAT), friend-clone verification.
- `cargo check` clean, `bun run typecheck` + `bun run lint` clean.
- Home-route placeholder shows a `github.com` URL.

## Tasks

- [ ] Scrub Gitea from `docs/architecture.md`
- [ ] Scrub Gitea from `docs/planned_features.md`
- [ ] Delete `docs/vps-setup.md`
- [ ] Write `docs/github-setup.md`
- [ ] `openspec/config.yaml`: `git_host: github`
- [ ] Scrub spec files
- [ ] Scrub `.github/copilot-instructions.md`
- [ ] Update home-route placeholder URL
- [ ] Update any in-code Gitea comments
- [ ] Validate: `cargo check`, `bun run typecheck`, `bun run lint`
- [ ] Commit: `refactor: switch pack source-of-truth from Gitea to GitHub`
