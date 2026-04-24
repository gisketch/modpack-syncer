# pack-gen — manifest generator

Resolves Modrinth project slugs to a fully-populated `manifest.json` (with SHA1, SHA512, filename, URL, size).

## Usage

1. Create `scripts/pack-gen.input.json` (see example below).
2. Run:

```bash
bun run scripts/pack-gen.ts scripts/pack-gen.input.json ./manifest.json
```

3. Commit `manifest.json` to your pack repo.

## Input format

```jsonc
{
  "name": "modsync",
  "icon": "https://example.com/icon32x32.png", // optional: pack artwork shown in app
  "version": "0.1.0",
  "mcVersion": "1.21.1",
  "loader": "fabric",                 // "neoforge" | "fabric" | "forge" | "quilt"
  "loaderVersion": "0.16.10",
  "channel": "release",               // optional: "release" | "beta" | "alpha" — filters versions
  "mods": [
    { "modrinth": "sodium" },         // slug OR project id
    { "modrinth": "lithium" },
    { "modrinth": "fabric-api", "versionId": "P7uGFio0" }  // pin exact version
  ],
  "resourcepacks": [],
  "shaderpacks": []
}
```

## What it does

- For each `modrinth` entry, queries `https://api.modrinth.com/v2/project/<slug>/version` filtered by `mcVersion` + `loader`.
- Picks the newest matching version (respecting `channel` and explicit `versionId` pins).
- Grabs the primary file's URL, filename, SHA1, SHA512, size.
- Writes a manifest with `schemaVersion: 1`.

## Limits

- Modrinth only for now. CurseForge needs an API key and will be added when author-mode (M4) lands.
- Rate limit: script sleeps 100 ms between calls. Adjust `DELAY_MS` if you hit 429s.
