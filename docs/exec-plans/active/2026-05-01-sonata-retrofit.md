# Sonata Retrofit

## Goal

Normalize this existing modsync project into a Sonata-compatible harness so future harness changes have a clear map, source-of-truth order, execution-plan workflow, and validation commands.

## Acceptance Criteria

- Root `AGENTS.md` stays short and points to durable context.
- Core docs exist and contain real project facts, not scaffold placeholders.
- Existing product docs and OpenSpec files stay preserved and linked.
- Quality commands are documented.
- `./scripts/check-sonata.sh` passes.

## Context Links

- [AGENTS.md](../../../AGENTS.md)
- [docs/index.md](../../index.md)
- [docs/project-brief.md](../../project-brief.md)
- [docs/architecture/index.md](../../architecture/index.md)
- [docs/quality.md](../../quality.md)
- [openspec/config.yaml](../../../openspec/config.yaml)

## Steps

- [x] Inventory source layout, docs, scripts, specs, and agent files.
- [x] Preserve existing docs by linking them from the harness index and architecture map.
- [x] Replace scaffold placeholders with project-specific facts.
- [x] Add stack validation commands to quality docs.
- [x] Run Sonata check.

## Validation

- `./scripts/check-sonata.sh`

## Decision Log

- Keep `docs/architecture.md` as preserved long-form architecture notes instead of moving it, because existing README and docs already link to it.
- Treat OpenSpec as the behavior source of truth and Sonata docs as the agent/harness map.
- No app behavior changes in this retrofit.

## Progress Log

- 2026-05-01: Inventory found Tauri 2, React 19, TypeScript, Vite, Tailwind v4, Bun, Rust 2021, OpenSpec specs/changes, and existing untracked Sonata scaffold files.
- 2026-05-01: `./scripts/check-sonata.sh` passed.
