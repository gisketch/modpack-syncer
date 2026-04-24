# GitHub setup — pack repository

This guide covers creating a GitHub repo that `modsync` friends can clone, and configuring push access for you (the pack author).

The pack repo holds **text only** — `manifest.json`, `configs/`, `kubejs/`, `profiles/`, `CHANGELOG.md`. No mod jars (those come from Modrinth / CurseForge CDNs, resolved from the manifest).

---

## 1. Create the repo

1. Go to [github.com/new](https://github.com/new).
2. **Repository name**: `modsync-pack` (or whatever name you want).
3. **Visibility: Public** — required so friends can clone without signing in or providing a PAT.
4. Initialize with a README: optional.
5. Create.

Your clone URL is now `https://github.com/<your-username>/modsync-pack.git`. That's the URL friends paste into modsync.

---

## 2. Bootstrap the pack

Clone locally and add the minimum files:

```bash
git clone https://github.com/<your-username>/modsync-pack.git
cd modsync-pack

# Generate a manifest from Modrinth slugs using the helper in the modsync repo
# (see scripts/pack-gen.ts in the modsync source)
bun run /path/to/modsync/scripts/pack-gen.ts my-input.json manifest.json

# Optional content dirs
mkdir -p configs kubejs overrides

git add -A
git commit -m "pack v0.1.0"
git push
```

See [../scripts/README.md](../scripts/README.md) for the `pack-gen` input format.

---

## 3. Configure push access — pick one

### Option A: SSH key (recommended, no expiring tokens)

```bash
ssh-keygen -t ed25519 -C "you@laptop"     # skip if you already have one
cat ~/.ssh/id_ed25519.pub
```

Add the pubkey at **GitHub → Settings → SSH and GPG keys → New SSH key**.

Change the remote to SSH:

```bash
git remote set-url origin git@github.com:<your-username>/modsync-pack.git
git push
```

### Option B: Personal Access Token (HTTPS)

Create a fine-grained PAT at **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:

- **Resource owner**: your user
- **Repository access**: Only select repositories → `modsync-pack`
- **Repository permissions → Contents**: Read and write
- **Expiration**: pick a date (90 d is sensible; rotate).
- Generate, copy the `github_pat_...` value (shown once).

Use it as the password when git prompts:

```bash
git push
# Username: <your-username>
# Password: <paste PAT>
```

Or let a credential helper store it (don't hardcode it in the remote URL).

> This is also the kind of token that modsync's future in-app publish flow (M3) will accept, stored in the OS keychain — never on disk in plaintext.

---

## 4. Verify the friend flow

From any machine without your credentials:

```bash
git clone https://github.com/<your-username>/modsync-pack.git /tmp/test-clone
ls /tmp/test-clone
```

If that works, modsync's Add Pack flow will too — it uses libgit2 against the same URL.

---

## 5. Release workflow (until M3 ships in-app publish)

1. Edit the pack (bump mod versions in `pack-gen` input, regenerate `manifest.json`, edit configs).
2. Update `CHANGELOG.md`.
3. Commit + tag:
   ```bash
   git add -A
   git commit -m "v0.2.0: add sodium, bump fabric-api"
   git tag v0.2.0
   git push --follow-tags
   ```
4. Friends open modsync → the app fetches `origin/main`, shows the diff, downloads new jars, updates the Prism instance.

Optional: create a GitHub Release off the tag with the CHANGELOG text — nice for humans, not required by the app.

---

## 6. Security notes

- **Repo stays public** so friends need no credentials. Nothing secret should live in the repo (no private mod keys, no auth tokens).
- **Rotate the PAT** periodically. Fine-grained, scoped to one repo, with expiration.
- If you ever need a **private** pack repo, that's a separate change — modsync doesn't yet prompt for a clone-time PAT. Open an issue first.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `modsync` says `404` on clone | Repo visibility is private, or URL typo. Make public. |
| Push rejected with `403` | PAT lacks Contents: write, or expired. Regenerate. |
| `Permission denied (publickey)` on SSH push | SSH key not added to GitHub account, or wrong key in `~/.ssh/config`. |
| `git2` / libgit2 HTTPS auth loops | Ensure the URL is `https://github.com/…`, not `git+https://…` or `http://…`. |
