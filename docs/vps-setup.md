# VPS setup — Gitea for modsync

This guide stands up a self-hosted Gitea instance on your VPS (the 12 GB EPYC box) and configures it so:

- **You (the admin / pack author)** can `git push` manifest changes from your laptop.
- **Your friends (consumers)** can `git clone` and `git fetch` the pack repo from the modsync app (anonymous, no login).

Target: Debian/Ubuntu host with Docker + Caddy (or any TLS reverse proxy). Adapt paths for your distro.

---

## 1. Prereqs on the VPS

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin ufw
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# log out/in once so group takes effect
```

Pick a subdomain, e.g. `git.yourdomain.tld`, and point an A record at the VPS IP.

Open firewall:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Caddy/certbot)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 2222/tcp  # Gitea SSH (for your pushes)
sudo ufw enable
```

> We expose Gitea's SSH on `2222` (not `22`) so it doesn't fight the host's OpenSSH.

---

## 2. Gitea via Docker Compose

Create `/srv/gitea/docker-compose.yml`:

```yaml
services:
  gitea:
    image: gitea/gitea:1.22
    container_name: gitea
    restart: unless-stopped
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__server__DOMAIN=git.yourdomain.tld
      - GITEA__server__ROOT_URL=https://git.yourdomain.tld/
      - GITEA__server__SSH_DOMAIN=git.yourdomain.tld
      - GITEA__server__SSH_PORT=2222
      - GITEA__server__SSH_LISTEN_PORT=22
      - GITEA__service__DISABLE_REGISTRATION=true
      - GITEA__service__REQUIRE_SIGNIN_VIEW=false
      - GITEA__repository__DEFAULT_PUSH_CREATE_PRIVATE=false
    volumes:
      - ./data:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "127.0.0.1:3000:3000"   # HTTP, behind reverse proxy
      - "2222:22"                # SSH for git push
```

Bring it up:

```bash
cd /srv/gitea
mkdir -p data
docker compose up -d
docker compose logs -f   # Ctrl-C once "Listen: http://0.0.0.0:3000" appears
```

---

## 3. Reverse proxy (Caddy)

Install Caddy if you don't have one:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] \
  https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```
git.yourdomain.tld {
    reverse_proxy 127.0.0.1:3000
    encode zstd gzip
}
```

Reload:

```bash
sudo systemctl reload caddy
```

TLS is automatic (Let's Encrypt). Visit `https://git.yourdomain.tld` — Gitea setup wizard should appear.

---

## 4. First-run wizard

On the setup page:

- **Database**: SQLite3 (path default) — simplest, fine for a single-user pack repo.
- **Server Domain**: `git.yourdomain.tld`
- **SSH Server Port**: `2222`
- **Gitea Base URL**: `https://git.yourdomain.tld/`
- **Disable self-registration**: checked (you already set the env var, but double-check).
- **Allow guests to view public pages / repos**: checked — this is what lets your friends clone anonymously.
- Create the **admin user** (e.g. `gisketch`) with a strong password.

Click **Install Gitea**. After redirect, log in as the admin.

---

## 5. Create the pack repo

In the Gitea UI:

1. **+** → **New Repository**
2. Owner: `gisketch` (your admin user)
3. Name: `modsync-pack` (or whatever)
4. **Visibility: Public** ← critical so friends can clone without a login
5. Initialize with README: checked
6. Create.

Repo URL is now:

- **Clone (HTTPS, public, no auth)**: `https://git.yourdomain.tld/gisketch/modsync-pack.git`
- **Push (SSH)**: `ssh://git@git.yourdomain.tld:2222/gisketch/modsync-pack.git`
- **Push (HTTPS + PAT)**: `https://git.yourdomain.tld/gisketch/modsync-pack.git` with a PAT in the password field

Give the HTTPS URL to your friends — paste it into modsync.

---

## 6. Enable admin push — pick one

### Option A: SSH key (recommended, no expiring tokens)

On your laptop:

```bash
ssh-keygen -t ed25519 -C "gisketch@laptop"         # if you don't already have one
cat ~/.ssh/id_ed25519.pub
```

In Gitea UI: **User menu → Settings → SSH / GPG Keys → Add Key**, paste the pubkey.

Add to your `~/.ssh/config`:

```
Host git.yourdomain.tld
    HostName git.yourdomain.tld
    Port 2222
    User git
    IdentityFile ~/.ssh/id_ed25519
```

Now you can push:

```bash
git clone ssh://git.yourdomain.tld/gisketch/modsync-pack.git
cd modsync-pack
# edit manifest.json, configs/, kubejs/, etc.
git add -A && git commit -m "v0.1.0" && git push
```

### Option B: Personal Access Token (HTTPS)

Use this if you can't open port 2222 for some reason, or if you want the modsync app itself to push later (M3).

In Gitea UI: **User menu → Settings → Applications → Generate New Token**

- **Token name**: `modsync-laptop` (or `modsync-app` for future in-app publish)
- **Scopes**: `write:repository` (enough for push)
- Click **Generate Token** and **copy it** (Gitea shows it exactly once).

Use it as the password when git prompts:

```bash
git clone https://git.yourdomain.tld/gisketch/modsync-pack.git
# Username: gisketch
# Password: <paste PAT>
```

Or bake it into the remote URL (less secure, plaintext in `~/.git-credentials`):

```bash
git remote set-url origin https://gisketch:<TOKEN>@git.yourdomain.tld/gisketch/modsync-pack.git
```

Prefer `git credential-manager` or `gh auth` for better secret handling.

---

## 7. Verify the friend flow

From any machine (no login, no VPN), the clone must succeed:

```bash
git clone https://git.yourdomain.tld/gisketch/modsync-pack.git /tmp/test-clone
ls /tmp/test-clone
```

If that works, modsync will too. The app uses libgit2 with the same public HTTPS URL.

---

## 8. Ongoing maintenance

- **Update Gitea**: `cd /srv/gitea && docker compose pull && docker compose up -d`
- **Backup**: snapshot `/srv/gitea/data` (SQLite DB, repo bares, LFS, avatars). Cron a nightly `tar.zst` to another host.
- **Logs**: `docker compose logs --tail=200 gitea`
- **Disk**: repos are tiny (text only — no mod jars). One pack ≈ a few MB.
- **Monitoring (optional)**: expose Gitea metrics under `GITEA__metrics__ENABLED=true` and scrape from Prometheus.

---

## 9. Security checklist

- [ ] `DISABLE_REGISTRATION=true` — no stranger sign-ups.
- [ ] Admin password is strong and saved in a password manager.
- [ ] SSH key on every authoring device; PAT only for machines that can't use SSH.
- [ ] PAT scope limited to `write:repository`; revoke + rotate if a laptop is lost.
- [ ] Host's real SSH (`22`) has password auth disabled and only your admin SSH key allowed (`/etc/ssh/sshd_config`: `PasswordAuthentication no`).
- [ ] UFW only allows 22, 80, 443, 2222.
- [ ] Automatic TLS via Caddy (no manual certbot drift).
- [ ] Regular Gitea image updates (security patches).

---

## 10. Future hooks (M3, author mode in the app)

When in-app publish lands, modsync will:

- Read the PAT from the OS keychain (never stored on disk in plain text).
- Use libgit2 with HTTPS + basic auth (`username=gisketch`, `password=<PAT>`).
- Commit + tag + push from within the app's "Publish" wizard.

Until then: use the CLI flow in §6.
