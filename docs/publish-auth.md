# Publish Auth Setup

`modsync` now supports two publish auth modes from Settings:

- `PAT` for HTTPS remotes using a GitHub personal access token stored in OS keychain
- `SSH` for remotes that use an SSH agent-loaded key

## PAT setup

1. Open GitHub settings and create a fine-grained or classic PAT with repository write access.
2. Open `modsync` Settings.
3. In `PUBLISH AUTH`, click `PAT`.
4. Paste token into `SAVE PAT` field.
5. Confirm pack repo remote uses HTTPS, for example `https://github.com/<owner>/<repo>.git`.

## SSH setup

1. Ensure pack repo remote uses SSH, for example `git@github.com:<owner>/<repo>.git`.
2. Start local SSH agent.
3. Add key to agent with `ssh-add`.
4. Open `modsync` Settings.
5. In `PUBLISH AUTH`, click `SSH`.

If SSH agent has no loaded key, `modsync` also tries common private keys from `~/.ssh/` in this order:

- `id_ed25519`
- `id_ecdsa`
- `id_rsa`
- `id_dsa`

Encrypted keys still need agent support because no passphrase prompt exists in app yet.

## Publish flow

1. Open pack detail page.
2. Click `PUBLISH`.
3. Review preview.
4. Click `APPLY TO REPO` to write working tree only, or `COMMIT + PUSH` to re-apply preview, create commit, and push current branch.

## Manual test case

Use this case after changing publish code:

1. Open linked Prism instance for a test pack.
2. Add one new local mod jar to `.minecraft/mods`.
3. Change one config file under `.minecraft/config`.
4. Remove one tracked resourcepack from `.minecraft/resourcepacks`.
5. Run `PUBLISH` preview and confirm `add`, `update`, and `remove` all appear.
6. Click `APPLY TO REPO`.
7. Verify pack repo working tree now contains:
   - new jar copied under `mods/`
   - config file updated under `configs/`
   - removed resourcepack dropped from manifest and repo artifact path
8. Run `COMMIT + PUSH` with test message.
9. Verify remote branch contains new commit and manifest hashes match repo files.