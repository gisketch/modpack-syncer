# Spec: app-shell

Application shell navigation and app identity behavior.

## Requirements

1. The sidebar header SHOULD show the saved Prism offline username under `:: NAVIGATION` when available, with `MODSYNC` as a fallback.
2. The sidebar MUST include an About navigation item alongside Packs and Settings.
3. The About route SHOULD present a concise project message explaining that modsync keeps friend-group Minecraft packs synced from a single GitHub source of truth.
4. The About route SHOULD expose the project GitHub URL through an external-open action.

## See

- [src/app.tsx](../../src/app.tsx)
- [src/routes/about.tsx](../../src/routes/about.tsx)
- [src/stores/nav-store.ts](../../src/stores/nav-store.ts)
