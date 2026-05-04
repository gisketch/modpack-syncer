# Spec: app-updates

In-app application update checks and installs.

## Requirements

1. The frontend MUST query the Tauri updater plugin for the latest available application update.
2. The app MUST check for updates from the configured GitHub Releases `latest.json` endpoint during app launch.
3. The app MUST surface update availability in the sidebar footer and settings/about UI when the updater reports a newer version.
4. Settings/About UI MUST provide a manual check-for-update action.
5. In-app install MUST only be offered on Windows builds. Other platforms may check for updates but MUST NOT expose the Windows installer flow.
6. When an install starts, the UI MUST stream download progress and transition to an installing state once the payload has finished downloading.
7. Successful install handoff MUST invalidate cached update state so a subsequent check reflects the new version.
8. If the updater endpoint is reachable but lacks an artifact for the current non-Windows platform, the UI SHOULD present this as an unsupported installer platform rather than a dangerous app failure.
9. macOS release artifacts SHOULD be ad-hoc signed when Apple Developer signing credentials are unavailable, and SHOULD be Developer ID signed and notarized when Apple credentials are configured, so downloaded Apple Silicon builds are not rejected as damaged by Gatekeeper.

## See

- [src/app.tsx](../../src/app.tsx)
- [src/hooks/use-app-update.ts](../../src/hooks/use-app-update.ts)
- [src/routes/settings.tsx](../../src/routes/settings.tsx)