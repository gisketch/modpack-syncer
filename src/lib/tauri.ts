import { invoke } from "@tauri-apps/api/core";

export type Loader = "neoforge" | "fabric" | "forge" | "quilt";
export type ModSource = "modrinth" | "curseforge" | "url" | "repo";
export type Side = "client" | "server" | "both";

export type ManifestEntry = {
  id: string;
  source: ModSource;
  projectId?: string | null;
  versionId?: string | null;
  repoPath?: string | null;
  filename: string;
  sha1: string;
  sha512?: string | null;
  size: number;
  url?: string | null;
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

export type PublishCategory =
  | "mods"
  | "resourcepacks"
  | "shaderpacks"
  | "config"
  | "kubejs"
  | "root";

export type PublishAction = "add" | "update" | "remove" | "unchanged";

export type PublishScanItem = {
  category: PublishCategory;
  relativePath: string;
  size?: number | null;
  sha1?: string | null;
  action: PublishAction;
  source?: string | null;
};

export type PublishScanReport = {
  instanceDir: string;
  items: PublishScanItem[];
};

export type PublishAuthSettings = {
  method?: string | null;
  hasPat: boolean;
};

export type PublishSshStatus = {
  verified: boolean;
  source?: string | null;
};

export type PublishApplyReport = {
  manifestEntriesWritten: number;
  repoFilesWritten: number;
  repoFilesRemoved: number;
};

export type PublishPushReport = {
  commitSha: string;
  method: string;
};

export type PackChangelogItem = {
  action: PublishAction;
  category: PublishCategory;
  count: number;
  details: string[];
};

export type PackChangelogEntry = {
  commitSha: string;
  packVersion: string;
  title: string;
  description: string;
  committedAt: number;
  items: PackChangelogItem[];
};

export type ModrinthAddPreview = {
  projectId: string;
  versionId: string;
  slug: string;
  title: string;
  description: string;
  iconUrl?: string | null;
  versionNumber: string;
  filename: string;
  size: number;
  suggestedSide: Side;
  alreadyTracked: boolean;
};

export type PrismLocation = {
  data_dir: string;
  binary: string;
};

export type InstanceWriteReport = {
  instance_dir: string;
  mods_written: number;
  resourcepacks_written: number;
  shaderpacks_written: number;
  overrides_copied: number;
};

export type SyncInstanceReport = {
  fetch: FetchReport;
  instance: InstanceWriteReport;
};

export type SyncProgressStatus =
  | "downloading"
  | "cached"
  | "downloaded"
  | "failed"
  | "writing-instance"
  | "done";

export type SyncProgressEvent = {
  packId: string;
  filename?: string | null;
  status: SyncProgressStatus;
  completed: number;
  total: number;
  cached: number;
  downloaded: number;
  failures: number;
};

/**
 * Typed wrappers around Tauri commands exposed by the Rust backend.
 * Keep this file in sync with `src-tauri/src/lib.rs#invoke_handler`.
 */
export const tauri = {
  greet: (name: string) => invoke<string>("greet", { name }),
  addPack: (url: string) => invoke<PackSummary>("add_pack", { url }),
  listPacks: () => invoke<PackSummary[]>("list_packs"),
  updatePack: (packId: string) => invoke<PackSummary>("update_pack", { packId }),
  loadManifest: (packId: string) => invoke<Manifest>("load_manifest", { packId }),
  getPublishAuthSettings: () => invoke<PublishAuthSettings>("get_publish_auth_settings"),
  setPublishAuthMethod: (method?: string | null) =>
    invoke<PublishAuthSettings>("set_publish_auth_method", { method }),
  savePublishPat: (token: string) =>
    invoke<PublishAuthSettings>("save_publish_pat", { token }),
  clearPublishPat: () => invoke<PublishAuthSettings>("clear_publish_pat"),
  verifyPublishSsh: () => invoke<PublishSshStatus>("verify_publish_ssh"),
  fetchMods: (packId: string) => invoke<FetchReport>("fetch_mods", { packId }),
  detectPrism: () => invoke<PrismLocation | null>("detect_prism"),
  syncInstance: (packId: string, instanceName?: string) =>
    invoke<SyncInstanceReport>("sync_instance", { packId, instanceName }),
  launchInstance: (instanceName: string) => invoke<void>("launch_instance", { instanceName }),
  getInstanceMinecraftDir: (instanceName: string) =>
    invoke<string | null>("get_instance_minecraft_dir", { instanceName }),
  packChangelog: (packId: string, limit?: number) =>
    invoke<PackChangelogEntry[]>("pack_changelog", { packId, limit }),
  suggestPublishVersion: (packId: string) =>
    invoke<string>("suggest_publish_version", { packId }),
  previewModrinthMod: (packId: string, identifier: string) =>
    invoke<ModrinthAddPreview>("preview_modrinth_mod", { packId, identifier }),
  addModrinthMod: (packId: string, projectId: string, versionId: string, side?: Side) =>
    invoke<ManifestEntry>("add_modrinth_mod", { packId, projectId, versionId, side }),
  deleteInstanceMod: (packId: string, filename: string, instanceName?: string) =>
    invoke<void>("delete_instance_mod", { packId, filename, instanceName }),
  modStatuses: (packId: string, instanceName?: string) =>
    invoke<ModStatus[]>("mod_statuses", { packId, instanceName }),
  scanInstancePublish: (packId: string, instanceName?: string) =>
    invoke<PublishScanReport>("scan_instance_publish", { packId, instanceName }),
  applyInstancePublish: (packId: string, instanceName?: string, version?: string) =>
    invoke<PublishApplyReport>("apply_instance_publish", { packId, instanceName, version }),
  commitAndPushPublish: (packId: string, message: string) =>
    invoke<PublishPushReport>("commit_and_push_publish", { packId, message }),
};

export type ModStatusValue = "synced" | "outdated" | "missing" | "deleted" | "unpublished";
export type ModStatus = {
  id?: string | null;
  filename: string;
  size?: number | null;
  status: ModStatusValue;
};
