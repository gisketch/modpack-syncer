#!/usr/bin/env bun
/**
 * pack-gen — generate a modsync manifest.json from Modrinth project slugs.
 *
 * Usage:
 *   bun run scripts/pack-gen.ts <input.json> <output.json>
 *
 * See scripts/README.md for the input format.
 */

const DELAY_MS = 100;
const USER_AGENT = "modsync-pack-gen/0.1 (https://github.com/gisketch/modsync)";
const MODRINTH_API = "https://api.modrinth.com/v2";

type Channel = "release" | "beta" | "alpha";
type Loader = "neoforge" | "fabric" | "forge" | "quilt";

type ModEntry = {
  modrinth: string;
  versionId?: string;
  optional?: boolean;
  side?: "client" | "server" | "both";
};

type Input = {
  name: string;
  icon?: string;
  version: string;
  mcVersion: string;
  loader: Loader;
  loaderVersion: string;
  channel?: Channel;
  mods?: ModEntry[];
  resourcepacks?: ModEntry[];
  shaderpacks?: ModEntry[];
};

type ModrinthFile = {
  hashes: { sha1: string; sha512: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
};

type ModrinthVersion = {
  id: string;
  project_id: string;
  version_number: string;
  version_type: Channel;
  game_versions: string[];
  loaders: string[];
  files: ModrinthFile[];
  date_published: string;
};

type ManifestEntry = {
  id: string;
  source: "modrinth";
  projectId: string;
  versionId: string;
  filename: string;
  sha1: string;
  sha512: string;
  size: number;
  url: string;
  optional?: boolean;
  side?: "client" | "server" | "both";
};

type Manifest = {
  schemaVersion: 1;
  pack: {
    name: string;
    icon?: string;
    version: string;
    mcVersion: string;
    loader: Loader;
    loaderVersion: string;
  };
  mods: ManifestEntry[];
  resourcepacks: ManifestEntry[];
  shaderpacks: ManifestEntry[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function channelRank(c: Channel): number {
  return c === "release" ? 3 : c === "beta" ? 2 : 1;
}

async function resolveEntry(
  entry: ModEntry,
  input: Input,
  projectType: "mod" | "resourcepack" | "shader",
): Promise<ManifestEntry> {
  const { modrinth: slug, versionId } = entry;

  // Project id lookup (so id is stable in manifest).
  const project = await fetchJson<{ id: string; slug: string; title: string }>(
    `${MODRINTH_API}/project/${slug}`,
  );
  await sleep(DELAY_MS);

  // Version list.
  const loadersFilter =
    projectType === "mod"
      ? [input.loader]
      : projectType === "resourcepack"
        ? ["minecraft"]
        : ["iris", "optifine"];
  const qs = new URLSearchParams({
    loaders: JSON.stringify(loadersFilter),
    game_versions: JSON.stringify([input.mcVersion]),
  });
  const versions = await fetchJson<ModrinthVersion[]>(
    `${MODRINTH_API}/project/${slug}/version?${qs}`,
  );
  await sleep(DELAY_MS);

  const wantChannel = input.channel ?? "release";
  const minRank = channelRank(wantChannel);
  let candidates = versions.filter((v) => channelRank(v.version_type) >= minRank);
  if (versionId) {
    candidates = versions.filter((v) => v.id === versionId);
  }
  if (candidates.length === 0) {
    throw new Error(
      `No matching version for ${slug} (mc=${input.mcVersion}, loader=${input.loader}, channel>=${wantChannel})`,
    );
  }
  candidates.sort(
    (a, b) =>
      new Date(b.date_published).getTime() - new Date(a.date_published).getTime(),
  );
  const picked = candidates[0];
  const file = picked.files.find((f) => f.primary) ?? picked.files[0];
  if (!file) throw new Error(`Version ${picked.id} for ${slug} has no files`);

  return {
    id: project.slug,
    source: "modrinth",
    projectId: project.id,
    versionId: picked.id,
    filename: file.filename,
    sha1: file.hashes.sha1,
    sha512: file.hashes.sha512,
    size: file.size,
    url: file.url,
    optional: entry.optional,
    side: entry.side,
  };
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error("Usage: bun run scripts/pack-gen.ts <input.json> <output.json>");
    process.exit(2);
  }
  const input: Input = JSON.parse(await Bun.file(inputPath).text());

  const mods: ManifestEntry[] = [];
  const resourcepacks: ManifestEntry[] = [];
  const shaderpacks: ManifestEntry[] = [];

  const total =
    (input.mods?.length ?? 0) +
    (input.resourcepacks?.length ?? 0) +
    (input.shaderpacks?.length ?? 0);
  let done = 0;

  const resolveInto = async (
    list: ModEntry[] | undefined,
    target: ManifestEntry[],
    type: "mod" | "resourcepack" | "shader",
  ) => {
    for (const e of list ?? []) {
      process.stdout.write(`[${++done}/${total}] ${type}: ${e.modrinth}… `);
      try {
        const resolved = await resolveEntry(e, input, type);
        target.push(resolved);
        console.log(`ok (${resolved.versionId})`);
      } catch (err) {
        console.log(`FAIL: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    }
  };

  await resolveInto(input.mods, mods, "mod");
  await resolveInto(input.resourcepacks, resourcepacks, "resourcepack");
  await resolveInto(input.shaderpacks, shaderpacks, "shader");

  const manifest: Manifest = {
    schemaVersion: 1,
    pack: {
      name: input.name,
      icon: input.icon,
      version: input.version,
      mcVersion: input.mcVersion,
      loader: input.loader,
      loaderVersion: input.loaderVersion,
    },
    mods,
    resourcepacks,
    shaderpacks,
  };

  await Bun.write(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `\nWrote ${outputPath} (${mods.length} mods, ${resourcepacks.length} rp, ${shaderpacks.length} sp)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
