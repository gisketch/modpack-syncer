# Project Brief

## One-Line Intent

Minecraft Java modpack syncer and Prism Launcher wrapper for friend-group packs.

## Project Kind

existing project

## Stack

Tauri 2 desktop app with React 19, TypeScript, Vite, Tailwind v4, Zustand, TanStack Query, and a Rust 2021 backend.

## Users

- Primary user: friend-group Minecraft players who need one app to install, sync, and launch a pack.
- Secondary users: pack admins who curate local Prism instances and publish changes back to the pack source of truth.
- Non-goals: replacing Prism Launcher auth/launch UX, storing Microsoft credentials, or committing mod jars to git.

## Problem

Custom Minecraft packs drift when players pass files around manually. The app keeps mods, configs, KubeJS, resource packs, shader packs, profiles, and selected options aligned from a Git pack repo into Prism instances. Packs can start as GitHub clones or local-only git repos that are pushed later.

## First Useful Version

Users can add a GitHub pack, sync verified artifacts into a Prism instance, review updates, and launch from Prism. Admins can preview local changes and publish pack updates.

## Acceptance Criteria

- User can sync a pack without installing git or manually moving files.
- User can see what changed before applying a sync.
- Admin can publish changes through a preview-first flow.
- System must use filename and file size for fast sync artifact checks.
- System must store secrets in the OS keychain, not plaintext files or logs.
- Project is not done until harness docs, OpenSpec behavior, and validation commands stay current with code changes.

## Constraints

- Package manager: Bun.
- Runtime: Tauri 2 shell, Rust backend, React frontend.
- Data: Git pack repo for text/source of truth; remote origin is optional for local authoring packs. Modrinth/CurseForge/upstream URLs for artifacts; local SQLite for client state/cache metadata.
- Security: manifest URL allowlist, no Microsoft credential handling, GitHub PAT in OS keychain.
- Performance: bounded parallel downloads, cache reuse, update deltas instead of full rewrites.
- Token budget:

## Open Questions

- Which OpenSpec changes are shipped versus still proposed.
- Which planned feature checklist items need status refresh after the latest implementation.
