#!/usr/bin/env bun

import { resolve } from "node:path";

const TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;

const repoRoot = resolve(import.meta.dir, "..");
const packageJsonPath = resolve(repoRoot, "package.json");
const tauriConfigPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(repoRoot, "src-tauri", "Cargo.toml");

function usage() {
  console.log("Usage: bun run scripts/release-verify.ts <tag>");
  console.log("Example: bun run scripts/release-verify.ts v0.2.3");
}

function parseTag(raw?: string) {
  if (!raw || raw === "--help" || raw === "-h") {
    usage();
    process.exit(raw ? 0 : 2);
  }
  const match = raw.match(TAG_PATTERN);
  if (!match) {
    throw new Error(`Invalid release tag: ${raw}`);
  }
  return match[1];
}

async function main() {
  const version = parseTag(process.argv[2]);
  const packageJson = JSON.parse(await Bun.file(packageJsonPath).text()) as { version: string };
  const tauriConfig = JSON.parse(await Bun.file(tauriConfigPath).text()) as { version: string };
  const cargoToml = await Bun.file(cargoTomlPath).text();
  const cargoVersion = cargoToml.match(/^version = "(.*)"$/m)?.[1];

  if (packageJson.version !== version || tauriConfig.version !== version || cargoVersion !== version) {
    throw new Error(`Release tag v${version} does not match all version files`);
  }

  console.log(`Release tag v${version} matches package.json, tauri.conf.json, and Cargo.toml`);
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});