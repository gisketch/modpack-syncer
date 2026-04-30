# Documentation Index

## Read First

- [Project Brief](project-brief.md)
- [Core Beliefs](core-beliefs.md)
- [Quality](quality.md)
- [Agent Targets](agent-targets.md)

## Deeper Context

- [Architecture](architecture/index.md)
- [Legacy Architecture Notes](architecture.md)
- [OpenSpec Config](../openspec/config.yaml)
- [OpenSpec Specs](../openspec/specs)
- [Execution Plans](exec-plans/README.md)
- [Harness Engineering](references/harness-engineering.md)
- [Caveman](references/caveman.md)

## Rule

If context matters after the chat ends, put it in this repo.

## Source Of Truth Order

1. [AGENTS.md](../AGENTS.md) for agent map and workflow.
2. [openspec/config.yaml](../openspec/config.yaml) and [openspec/specs](../openspec/specs) for behavior and constraints.
3. [Architecture](architecture/index.md) for code boundaries.
4. [Quality](quality.md) for reproducible validation.
5. Existing runbooks under `docs/` for release, setup, and feature-specific operations.

## Retrofit Rule

When adapting an existing project, use `/retrofit-sonata` first. Inventory, preserve, and reorganize before adding new features.
