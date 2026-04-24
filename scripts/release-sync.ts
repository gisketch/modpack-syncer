#!/usr/bin/env bun

import { resolve } from "node:path";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const repoRoot = resolve(import.meta.dir, "..");
const packageJsonPath = resolve(repoRoot, "package.json");
const tauriConfigPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(repoRoot, "src-tauri", "Cargo.toml");

function usage() {
  console.log("Usage: bun run release:sync <version>");
  console.log("Example: bun run release:sync 0.2.3");
}

function parseVersion(raw?: string) {
  if (!raw || raw === "--help" || raw === "-h") {
    usage();
    process.exit(raw ? 0 : 2);
  }
  if (!VERSION_PATTERN.test(raw)) {
    console.error(`Invalid semver: ${raw}`);
    process.exit(2);
  }
  return raw;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Bun.file(path).text()) as T;
}

async function writeJson(path: string, value: unknown) {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function syncCargoVersion(content: string, version: string) {
  if (!/^version = ".*"$/m.test(content)) {
    throw new Error("Could not update Cargo.toml package version");
  }
  return content.replace(/^version = ".*"$/m, `version = "${version}"`);
}

async function main() {
  const version = parseVersion(process.argv[2]);

  const packageJson = await readJson<Record<string, unknown>>(packageJsonPath);
  packageJson.version = version;
  await writeJson(packageJsonPath, packageJson);

  const tauriConfig = await readJson<Record<string, unknown>>(tauriConfigPath);
  tauriConfig.version = version;
  await writeJson(tauriConfigPath, tauriConfig);

  const cargoToml = await Bun.file(cargoTomlPath).text();
  await Bun.write(cargoTomlPath, syncCargoVersion(cargoToml, version));

  const syncedPackageJson = await readJson<{ version: string }>(packageJsonPath);
  const syncedTauriConfig = await readJson<{ version: string }>(tauriConfigPath);
  const syncedCargoToml = await Bun.file(cargoTomlPath).text();
  const cargoVersion = syncedCargoToml.match(/^version = "(.*)"$/m)?.[1];

  if (syncedPackageJson.version !== version || syncedTauriConfig.version !== version || cargoVersion !== version) {
    throw new Error("Version sync verification failed");
  }

  console.log(`Synced modsync version to ${version}`);
  console.log("Next: review diff, commit, then run bun run release:tag <version>");
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});