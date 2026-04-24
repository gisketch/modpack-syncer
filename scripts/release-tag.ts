#!/usr/bin/env bun

import { resolve } from "node:path";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const repoRoot = resolve(import.meta.dir, "..");
const packageJsonPath = resolve(repoRoot, "package.json");
const tauriConfigPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(repoRoot, "src-tauri", "Cargo.toml");

function usage() {
  console.log("Usage: bun run release:tag <version>");
  console.log("Example: bun run release:tag 0.2.3");
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

function runGit(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr).trim() || `git ${args.join(" ")} failed`);
  }
  return new TextDecoder().decode(result.stdout).trim();
}

async function readVersionState() {
  const packageJson = JSON.parse(await Bun.file(packageJsonPath).text()) as { version: string };
  const tauriConfig = JSON.parse(await Bun.file(tauriConfigPath).text()) as { version: string };
  const cargoToml = await Bun.file(cargoTomlPath).text();
  const cargoVersion = cargoToml.match(/^version = "(.*)"$/m)?.[1];

  return {
    packageVersion: packageJson.version,
    tauriVersion: tauriConfig.version,
    cargoVersion,
  };
}

async function main() {
  const version = parseVersion(process.argv[2]);
  const tag = `v${version}`;

  const dirty = runGit(["status", "--porcelain"]);
  if (dirty) {
    throw new Error("Working tree must be clean before tagging and pushing");
  }

  const state = await readVersionState();
  if (state.packageVersion !== version || state.tauriVersion !== version || state.cargoVersion !== version) {
    throw new Error(`Version files do not all match ${version}`);
  }

  const tagExists = Bun.spawnSync(["git", "rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
    cwd: repoRoot,
    stdout: "ignore",
    stderr: "ignore",
  }).exitCode === 0;
  if (tagExists) {
    throw new Error(`Tag already exists: ${tag}`);
  }

  runGit(["tag", tag]);
  runGit(["push", "origin", tag]);

  console.log(`Created and pushed ${tag}`);
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});