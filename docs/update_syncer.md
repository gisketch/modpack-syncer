# modsync Release Guide

Use this guide every time a new `modsync` app release should go out.

This project currently publishes Windows releases through GitHub Actions and also generates updater artifacts used by the in-app Windows self-updater.

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
2. Open workflow `release-windows`.
3. Wait for the tagged run to finish successfully.

The workflow will:

- verify tag/version match again
- build the Windows app
- upload release assets
- upload updater signatures
- upload `latest.json`

### 9. Verify the GitHub Release page

Open the GitHub release for the new tag and confirm it contains Windows release assets plus updater files.

At minimum, verify:

- Windows installer asset exists
- signature files exist
- `latest.json` exists

### 10. Smoke-test updater behavior

After one release is live, test updater behavior from an older installed Windows build.

Confirm:

1. app opens normally
2. update check finds the newer version
3. sidebar shows `UPDATE NOW`
4. installer launches successfully

## Important rules

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