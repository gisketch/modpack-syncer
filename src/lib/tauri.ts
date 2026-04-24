import { invoke } from "@tauri-apps/api/core";

export type Loader = "neoforge" | "fabric" | "forge" | "quilt";
export type ModSource = "modrinth" | "curseforge" | "url";
export type Side = "client" | "server" | "both";

export type ManifestEntry = {
  id: string;
  source: ModSource;
  projectId?: string | null;
  versionId?: string | null;
  filename: string;
  sha1: string;
  sha512?: string | null;
  size: number;
  url: string;
  optional: boolean;
  side: Side;
};

export type Manifest = {
  schemaVersion: number;
  pack: {
    name: string;
    version: string;
    mcVersion: string;
    loader: Loader;
    loaderVersion: string;
  };
  mods: ManifestEntry[];
  resourcepacks: ManifestEntry[];
  shaderpacks: ManifestEntry[];
};

export type PackSummary = {
  id: string;
  url: string;
  path: string;
  head_sha: string;
};

export type FetchReport = {
  total: number;
  cached: number;
  downloaded: number;
  failures: string[];
};

export type PrismLocation = {
  data_dir: string;
  binary: string;
};

export type InstanceWriteReport = {
  instance_dir: string;
  mods_written: number;
  overrides_copied: number;
};

export type SyncInstanceReport = {
  fetch: FetchReport;
  instance: InstanceWriteReport;
};

/**
 * Typed wrappers around Tauri commands exposed by the Rust backend.
 * Keep this file in sync with `src-tauri/src/lib.rs#invoke_handler`.
 */
export const tauri = {
  greet: (name: string) => invoke<string>("greet", { name }),
  addPack: (url: string) => invoke<PackSummary>("add_pack", { url }),
  listPacks: () => invoke<PackSummary[]>("list_packs"),
  loadManifest: (packId: string) => invoke<Manifest>("load_manifest", { packId }),
  fetchMods: (packId: string) => invoke<FetchReport>("fetch_mods", { packId }),
  detectPrism: () => invoke<PrismLocation | null>("detect_prism"),
  syncInstance: (packId: string, instanceName?: string) =>
    invoke<SyncInstanceReport>("sync_instance", { packId, instanceName }),
  launchInstance: (instanceName: string) => invoke<void>("launch_instance", { instanceName }),
  modStatuses: (packId: string, instanceName?: string) =>
    invoke<ModStatus[]>("mod_statuses", { packId, instanceName }),
};

export type ModStatusValue = "synced" | "outdated" | "missing";
export type ModStatus = { id: string; status: ModStatusValue };
