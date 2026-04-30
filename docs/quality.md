# Quality

## Current Checks

| Check | Command | When To Run |
|---|---|---|
| Sonata structure | `./scripts/check-sonata.sh` | After scaffold, docs, or skill changes |
| Frontend lint/format check | `bun run lint` | Before frontend handoff |
| TypeScript check | `bun run typecheck` | Before frontend handoff |
| Frontend unit tests | `bun run test` | Before frontend behavior handoff |
| Frontend build | `bun run build` | Before release-impacting frontend changes |
| Rust unit tests | `cd src-tauri && cargo test` | Before backend behavior handoff |
| Rust format check | `cd src-tauri && cargo fmt --check` | Before backend handoff |
| Rust lint | `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` | Before backend handoff |
| Tauri app build | `bun run tauri build` | Before release packaging or updater work |

## Retrofit Checks

When `/retrofit-sonata` runs, verify:

- Existing markdown was preserved, moved, linked, or summarized.
- `AGENTS.md` stayed short.
- Project commands in this file are verified or marked unverified.
- Broad migration work has an execution plan.

## Install

- `bun install` installs frontend and Tauri CLI dependencies.
- Rust dependencies resolve through Cargo in `src-tauri/`.

## Smoke Runs

- `bun run dev` starts the Vite frontend only.
- `bun run tauri dev` starts the full desktop app.

## Quality Bar

- Acceptance criteria exist before broad implementation.
- Validation is reproducible by another agent.
- New decisions update docs.
- Repeated failures become docs, scripts, tests, or tighter prompts.
