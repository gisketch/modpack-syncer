# Spec: app-updates

In-app application update checks and installs.

## Requirements

1. The frontend MUST query the Tauri updater plugin for the latest available application update.
2. The app MAY surface update availability in the shell and settings UI when the updater reports a newer version.
3. In-app install MUST only be offered on Windows builds. Other platforms may check for updates but MUST NOT expose the Windows installer flow.
4. When an install starts, the UI MUST stream download progress and transition to an installing state once the payload has finished downloading.
5. Successful install handoff MUST invalidate cached update state so a subsequent check reflects the new version.

## See

- [src/app.tsx](../../src/app.tsx)
- [src/hooks/use-app-update.ts](../../src/hooks/use-app-update.ts)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)