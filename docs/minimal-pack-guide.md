# Bare-minimum pack — quick start

Get your first pack live on GitHub in under 5 minutes. Friends can then clone it via modsync.

---

## 1. Create the GitHub repo

Follow [github-setup.md](./github-setup.md) §1 — public repo, empty or with a README.

```bash
git clone https://github.com/<you>/modsync-pack.git
cd modsync-pack
```

---

## 2. Drop in the minimum files

### `manifest.json` — the only required file

This example targets **Minecraft 1.21.1 + Fabric** with three client-optimization mods.

```json
{
  "schemaVersion": 1,
  "pack": {
    "name": "modsync-minimal",
    "version": "0.1.0",
    "mcVersion": "1.21.1",
    "loader": "fabric",
    "loaderVersion": "0.16.10"
  },
  "mods": [
    {
      "id": "fabric-api",
      "source": "modrinth",
      "projectId": "P7dR8mSH",
      "versionId": "IpaMcBLh",
      "filename": "fabric-api-0.116.11+1.21.1.jar",
      "sha1": "65f4e8b9dcbad6697b2fb32fa0bb937ec5efcd84",
      "sha512": "756b8c086f4c911d012f2eb70ca792aef0439503b31bc52026b82830870a94d472de30d61a6a0a9988c02b8462d9c47aa6baa6cd84da1eaf00edb77249b3c413",
      "size": 2426356,
      "url": "https://cdn.modrinth.com/data/P7dR8mSH/versions/IpaMcBLh/fabric-api-0.116.11%2B1.21.1.jar"
    },
    {
      "id": "sodium",
      "source": "modrinth",
      "projectId": "AANobbMI",
      "versionId": "u1OEbNKx",
      "filename": "sodium-fabric-0.6.13+mc1.21.1.jar",
      "sha1": "928a2598178c3a58b0638bab842f467d2e49251a",
      "sha512": "13032e064c554fc8671573dadb07bc70e6ea2f68706c65c086c4feb1d2f664346a3414cbf9d1367b42b8d063a35e40f2f967ef9af31642e1f0093b852161fe91",
      "size": 1297761,
      "url": "https://cdn.modrinth.com/data/AANobbMI/versions/u1OEbNKx/sodium-fabric-0.6.13%2Bmc1.21.1.jar"
    },
    {
      "id": "lithium",
      "source": "modrinth",
      "projectId": "gvQqBUqZ",
      "versionId": "XQJtuOTA",
      "filename": "lithium-fabric-0.15.3+mc1.21.1.jar",
      "sha1": "c4a1c2b6de9915ac77ae46a005509d4acf09535d",
      "sha512": "8c576d519121b0c2521101d2209eccd85d560b097fcb847aa54c51cd0d3f3947676f01c8d99913f514487c8e0972a1cf5f3da0c9ef0ec9bacdf2baeb4eb7d1a7",
      "size": 797398,
      "url": "https://cdn.modrinth.com/data/gvQqBUqZ/versions/XQJtuOTA/lithium-fabric-0.15.3%2Bmc1.21.1.jar"
    }
  ],
  "resourcepacks": [],
  "shaderpacks": []
}
```

> Hashes and URLs above came from a live Modrinth lookup. If you change mods or versions, regenerate with the helper (see §4).

### `README.md` — describe the pack

```md
# modsync-minimal

Minimal 1.21.1 Fabric pack for modsync smoke-testing.

- Fabric API
- Sodium
- Lithium
```

### Optional empty dirs

Only add these if you'll actually sync content through them:

```bash
mkdir -p configs kubejs overrides
touch configs/.gitkeep kubejs/.gitkeep overrides/.gitkeep
```

- `configs/` → copied into `.minecraft/config/` on sync
- `kubejs/` → copied into `.minecraft/kubejs/` on sync
- `overrides/` → copied into `.minecraft/` root on sync (drop-in extras)

---

## 3. Commit + push

```bash
git add -A
git commit -m "initial pack v0.1.0"
git push
```

Repo URL is now friend-ready:

```
https://github.com/<you>/modsync-pack.git
```

Paste that into modsync's onboarding screen.

---

## 4. Changing mods — regenerate the manifest

Writing SHA1/SHA512 by hand is painful. Use the generator in the modsync source tree:

```bash
# From inside your modsync-pack repo:
cat > pack-gen.json <<'EOF'
{
  "name": "modsync-minimal",
  "version": "0.2.0",
  "mcVersion": "1.21.1",
  "loader": "fabric",
  "loaderVersion": "0.16.10",
  "channel": "release",
  "mods": [
    { "modrinth": "fabric-api" },
    { "modrinth": "sodium" },
    { "modrinth": "lithium" },
    { "modrinth": "iris" }
  ]
}
EOF

bun run /path/to/modsync/scripts/pack-gen.ts pack-gen.json manifest.json
git add manifest.json pack-gen.json
git commit -m "v0.2.0: add iris"
git push
```

Full input reference: [../scripts/README.md](../scripts/README.md).

---

## 5. What the pack does NOT need

- **No mod jars** — they come from Modrinth CDN, resolved at sync time.
- **No Java / NeoForge / Fabric installer** — Prism handles loader install.
- **No `.gitignore`** — repo is text-only, nothing to ignore.
- **No CI** — pushing is the publish. Tag (`v0.2.0`) optional.

---

## 6. Verify end-to-end

1. Start modsync: `bun run tauri dev` (from the modsync source).
2. Onboarding screen appears → paste your repo URL → Clone pack.
3. Home screen shows the pack card with `v0.1.0 · MC 1.21.1 · fabric · 3 mods`.
4. Click **Sync** → mods download, Prism instance `modsync-<pack-id>` is written.
5. Open Prism → you should see the new instance with all 3 mods under `.minecraft/mods/`.
6. Back in modsync click **Launch** → Prism launches the instance.

If Prism isn't detected, install it from [prismlauncher.org](https://prismlauncher.org/). modsync does not bundle Prism.
