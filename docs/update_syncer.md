# modsync Release Guide

Use this guide every time a new `modsync` app release should go out.

This project publishes Windows and macOS releases through GitHub Actions and generates updater artifacts used by the in-app self-updater.

## One-time setup

Do this once before the first updater-enabled release.

### 1. Keep the updater key safe

`modsync` must keep using the same updater signing key for every future release.

- Private key file: `~/.tauri/modsync-updater.key`
- Public key file: `~/.tauri/modsync-updater.key.pub`

Do not rotate this key unless you intentionally want to break update trust for older installs.

### 2. Add GitHub Actions secrets

Open GitHub repository settings:

1. Go to `Settings`.
2. Go to `Secrets and variables`.
3. Go to `Actions`.
4. Create repository secret `TAURI_SIGNING_PRIVATE_KEY`.
5. Paste the full contents of `~/.tauri/modsync-updater.key` into that secret.

Important:

- Use the private key file, not the `.pub` file.
- Use the full multiline key contents, not a file path.
- Do not paste the public key from `src-tauri/tauri.conf.json`.

Optional:

1. Create repository secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only if the key was created with a password.
2. Leave that secret unset if the key has no password.

### 3. Add macOS signing secrets

GitHub-downloaded macOS apps can open with a damaged/corrupted warning if they are unsigned, especially on Apple Silicon. The release workflow now ad-hoc signs macOS builds when Apple Developer signing secrets are missing. That helps Apple Silicon launch checks, but public releases should still use Developer ID signing plus notarization.

For Gatekeeper-friendly macOS DMGs, create an Apple Developer `Developer ID Application` certificate, export it from Keychain Access as a password-protected `.p12`, then add these GitHub Actions secrets:

1. `APPLE_CERTIFICATE`: base64 contents of the exported `.p12`:
	```bash
	openssl base64 -A -in /path/to/certificate.p12 -out certificate-base64.txt
	```
2. `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`.
3. `APPLE_SIGNING_IDENTITY`: optional. Leave unset unless Tauri cannot infer the identity from `APPLE_CERTIFICATE`.

For notarization, create an App Store Connect API key and add these GitHub Actions secrets:

1. `APPLE_API_KEY`: key ID, for example `ABCD123456`.
2. `APPLE_API_ISSUER`: issuer ID from App Store Connect.
3. `APPLE_API_PRIVATE_KEY`: full contents of the downloaded `AuthKey_<key-id>.p8` file.

The Tauri updater signing key is separate. It signs updater artifacts; it does not satisfy macOS Gatekeeper.

### 4. macOS build host

macOS app bundles must be built on macOS. You do not need a physical Mac for normal release builds because the release workflow uses GitHub-hosted `macos-latest` runners.

This workflow builds macOS `.app` / `.dmg` assets for both Apple Silicon and Intel. Without Apple Developer secrets, macOS builds are ad-hoc signed. With the signing and notarization secrets above, Tauri produces Developer ID signed and notarized artifacts.

## Files involved in every release

These files must stay on the same version:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Use the built-in scripts instead of editing these by hand.

## Release flow for every future version

Example target version below uses `0.2.3`. Replace it with the real next version.

### 1. Sync version files

```bash
cd /home/holmes/devfiles/modpack-syncer
bun run release:sync 0.2.3
```

This updates:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

### 2. Verify tag matches version files

```bash
bun run release:verify v0.2.3
```

### 3. Run local checks

```bash
bun run typecheck
cd src-tauri && cargo check
cd ..
```

If these fail, fix the issue before releasing.

### 4. Review the diff

Check exactly what will go into the release:

```bash
git --no-pager status --short
git --no-pager diff --stat
```

### 5. Commit the release-ready state

```bash
git add .
git commit -m "Release 0.2.3"
```

Use a different commit message if needed, but commit before creating the tag.

### 6. Push the branch first

```bash
git push origin main
```

If releasing from another branch, push that branch instead.

### 7. Create and push the release tag

```bash
bun run release:tag 0.2.3
```

That script will:

- verify working tree is clean
- verify the three version files match `0.2.3`
- create tag `v0.2.3`
- push tag to `origin`

### 8. Watch GitHub Actions

After the tag push:

1. Open GitHub Actions.
2. Open workflow `release-desktop`.
3. Wait for the tagged run to finish successfully.

The workflow will:

- verify tag/version match again
- build the Windows app
- build the macOS Apple Silicon app
- build the macOS Intel app
- upload release assets
- upload updater signatures
- upload `latest.json`

### 9. Verify the GitHub Release page

Open the GitHub release for the new tag and confirm it contains Windows and macOS release assets plus updater files.

At minimum, verify:

- Windows installer asset exists
- macOS Apple Silicon DMG/app asset exists
- macOS Intel DMG/app asset exists
- signature files exist
- `latest.json` exists

### 10. Smoke-test updater behavior

After one release is live, test updater behavior from an older installed Windows or macOS build.

Confirm:

1. app opens normally
2. update check finds the newer version
3. sidebar shows `UPDATE NOW`
4. installer launches successfully

## Important rules

### Mac says the app is damaged or corrupted

If a downloaded macOS DMG says the app is damaged, the most likely cause is Gatekeeper rejecting an unsigned or unnotarized app, not a bad download. The durable fix is to configure the Apple signing and notarization secrets above, then publish a new release tag.

For a trusted local test build only, install the app from the DMG, then remove the quarantine attribute:

```bash
xattr -dr com.apple.quarantine "/Applications/gisketch_s_modpack_syncer.app"
open "/Applications/gisketch_s_modpack_syncer.app"
```

If the app is still on the mounted DMG volume, copy it to `/Applications` first and run the command on the copied app.

### Never reuse an already-pushed tag by accident

If `v0.2.2` already exists upstream, do not keep using `0.2.2` for new code.

Release the next version instead, for example `0.2.3`.

### Never change version files manually right before tagging

Always use:

```bash
bun run release:sync <version>
```

### Never tag with a dirty working tree

`bun run release:tag <version>` intentionally refuses to run if files are still modified.

That is expected and protects releases.

## Quick checklist

Use this short version when already familiar with the flow.

```bash
cd /home/holmes/devfiles/modpack-syncer
bun run release:sync 0.2.3
bun run release:verify v0.2.3
bun run typecheck
cd src-tauri && cargo check && cd ..
git add .
git commit -m "Release 0.2.3"
git push origin main
bun run release:tag 0.2.3
```

Then watch GitHub Actions and verify release assets on GitHub.
