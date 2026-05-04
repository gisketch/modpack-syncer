import { invoke } from "@tauri-apps/api/core";

export type Loader = "neoforge" | "fabric" | "forge" | "quilt";
export type ModSource = "modrinth" | "curseforge" | "url" | "repo";
export type Side = "client" | "server" | "both";
export type ManifestArtifactCategory = "mods" | "resourcepacks" | "shaderpacks";

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
    icon?: string | null;
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
  is_local: boolean;
};

export type PackTransferProgressEvent = {
  packId: string;
  stage: string;
  receivedObjects: number;
  totalObjects: number;
  indexedObjects: number;
  receivedBytes: number;
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
  | "shader-settings"
  | "option-presets"
  | "launch-presets"
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

export type PublishScanProgressEvent = {
  packId: string;
  stage: string;
  currentPath?: string | null;
  completed: number;
  total: number;
};

export type PublishPushProgressEvent = {
  packId: string;
  stage: string;
  currentPath?: string | null;
  completed: number;
  total: number;
  bytes?: number | null;
  message?: string | null;
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

export type OptionsSyncCategory = "keybinds" | "video" | "other";

export type OptionsSyncChange = {
  category: OptionsSyncCategory;
  key: string;
  packValue?: string | null;
  instanceValue?: string | null;
  action: PublishAction;
  ignored: boolean;
};

export type OptionsSyncGroup = {
  category: OptionsSyncCategory;
  label: string;
  description: string;
  changes: OptionsSyncChange[];
};

export type OptionsSyncPreview = {
  hasPackFile: boolean;
  hasInstanceFile: boolean;
  groups: OptionsSyncGroup[];
  ignoredKeys: string[];
};

export const PACK_DEFAULT_PRESET_ID = "__pack-default";
export const NO_OPTION_PRESET_ID = "__none";

export type OptionPresetScope = "video" | "keybinds" | "other" | "shader-iris" | "shader-preset";

export type OptionPresetCounts = {
  video: number;
  keybinds: number;
  other: number;
  shader: number;
  files: number;
  disabledMods: number;
};

export type OptionPresetSummary = {
  id: string;
  label: string;
  description: string;
  counts: OptionPresetCounts;
  shaderPack?: string | null;
  disabledMods: string[];
};

export type OptionPresetRow = {
  scope: OptionPresetScope;
  key: string;
  value: string;
  included: boolean;
  source: string;
};

export type OptionPresetCapture = {
  rows: OptionPresetRow[];
  shaderPack?: string | null;
  files: OptionPresetFileRow[];
  mods: OptionPresetModRow[];
};

export type OptionPresetEditDraft = {
  id: string;
  label: string;
  description: string;
  rows: OptionPresetRow[];
  shaderPack?: string | null;
  files: OptionPresetFileRow[];
  mods: OptionPresetModRow[];
};

export type OptionPresetFileRow = {
  relPath: string;
  included: boolean;
  size: number;
};

export type OptionPresetModRow = {
  filename: string;
  disabled: boolean;
  optional: boolean;
};

export type SaveOptionPresetDraft = {
  id: string;
  label: string;
  description: string;
  shaderPack?: string | null;
  rows: OptionPresetRow[];
  files: OptionPresetFileRow[];
  disabledMods: string[];
};

export type ShaderSettingsStatus =
  | "missing-pack-config"
  | "matched"
  | "mismatch"
  | "disabled-local"
  | "missing-preset";

export type ShaderSettingsPreview = {
  status: ShaderSettingsStatus;
  hasPackIrisFile: boolean;
  hasInstanceIrisFile: boolean;
  packShaderPack?: string | null;
  localShaderPack?: string | null;
  packShadersEnabled: boolean;
  localShadersEnabled: boolean;
  packPresetPath?: string | null;
  localPresetPath?: string | null;
  irisDiffCount: number;
  presetDiffCount: number;
  irisChanges: ShaderSettingsChange[];
  presetChanges: ShaderSettingsChange[];
  requiresDecision: boolean;
};

export type ShaderSettingsChange = {
  key: string;
  packValue?: string | null;
  instanceValue?: string | null;
  action: PublishAction;
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

export type ModrinthSearchSort = "relevance" | "downloads" | "follows" | "newest" | "updated";
export type ModrinthSearchSide = "all" | "client" | "server" | "both";

export type ModrinthSearchHit = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  iconUrl?: string | null;
  downloads: number;
  follows: number;
  dateModified?: string | null;
  categories: string[];
  versions: string[];
  suggestedSide: Side;
  alreadyTracked: boolean;
  trackedVersionId?: string | null;
  trackedSide?: Side | null;
};

export type ModrinthSearchReport = {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  totalHits: number;
  mcVersion: string;
  loader: string;
};

export type ModrinthVersionSummary = {
  id: string;
  versionNumber: string;
  filename: string;
  size: number;
  datePublished?: string | null;
};

export type ModrinthDependencySummary = {
  projectId: string;
  versionId: string;
  slug: string;
  title: string;
  iconUrl?: string | null;
  versionNumber: string;
  filename: string;
  alreadyTracked: boolean;
};

export type PrismLocation = {
  data_dir: string;
  binary: string;
};

export type PrismSettings = {
  binaryPath?: string | null;
  dataDir?: string | null;
  offlineUsername?: string | null;
  offlineUuid?: string | null;
};

export type InstallDirectorySettings = {
  defaultDir?: string | null;
  effectiveDir: string;
};

export type PrismAccountStatus = {
  state: string;
  displayName?: string | null;
};

export type InstalledJavaRuntime = {
  javaPath: string;
  installDir: string;
  displayName: string;
  major: number;
  imageType: string;
  releaseName: string;
};

export type ManagedPrismInstall = {
  binaryPath: string;
  dataDir: string;
  installDir: string;
  version: string;
  assetName: string;
  releaseUrl: string;
  offlineSupported: boolean;
};

export type LaunchProfile = {
  minMemoryMb: number;
  maxMemoryMb: number;
  javaPath?: string | null;
  extraJvmArgs: string;
  autoJava: boolean;
  showConsole?: boolean;
};

export type LaunchPreset = {
  id: string;
  label: string;
  description: string;
  minMemoryMb: number;
  maxMemoryMb: number;
  extraJvmArgs: string;
  autoJava: boolean;
};

export type LaunchPresetConfig = {
  presets: LaunchPreset[];
  defaultPresetId: string;
  memoryMinMb: number;
  memoryMaxMb: number;
  memoryStepMb: number;
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
  | "resolving-artifacts"
  | "writing-instance"
  | "syncing-options"
  | "syncing-shaders"
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

export type JavaInstallProgressEvent = {
  packId: string;
  stage: string;
  progress: number;
  currentBytes?: number | null;
  totalBytes?: number | null;
  logLine?: string | null;
};

export type PrismInstallProgressEvent = {
  stage: string;
  progress: number;
  currentBytes?: number | null;
  totalBytes?: number | null;
  logLine?: string | null;
};

/**
 * Typed wrappers around Tauri commands exposed by the Rust backend.
 * Keep this file in sync with `src-tauri/src/lib.rs#invoke_handler`.
 */
export const tauri = {
  greet: (name: string) => invoke<string>("greet", { name }),
  getInstallDirectory: () => invoke<InstallDirectorySettings>("get_install_directory"),
  setInstallDirectory: (defaultDir?: string | null) =>
    invoke<InstallDirectorySettings>("set_install_directory", { defaultDir }),
  addPack: (url: string) => invoke<PackSummary>("add_pack", { url }),
  createLocalPack: (name: string, mcVersion: string, loader: Loader, loaderVersion: string) =>
    invoke<PackSummary>("create_local_pack", { name, mcVersion, loader, loaderVersion }),
  listPacks: () => invoke<PackSummary[]>("list_packs"),
  updatePack: (packId: string) => invoke<PackSummary>("update_pack", { packId }),
  refreshPackForAction: (packId: string) =>
    invoke<PackSummary>("refresh_pack_for_action", { packId }),
  loadManifest: (packId: string) => invoke<Manifest>("load_manifest", { packId }),
  loadSourceManifest: (packId: string) => invoke<Manifest>("load_source_manifest", { packId }),
  restoreManifestFromSource: (packId: string) =>
    invoke<Manifest>("restore_manifest_from_source", { packId }),
  setManifestModOptional: (packId: string, filename: string, optional: boolean) =>
    invoke<ManifestEntry>("set_manifest_mod_optional", { packId, filename, optional }),
  setManifestArtifactOptional: (
    packId: string,
    category: ManifestArtifactCategory,
    filename: string,
    optional: boolean,
  ) =>
    invoke<ManifestEntry>("set_manifest_artifact_optional", {
      packId,
      category,
      filename,
      optional,
    }),
  deleteManifestArtifact: (packId: string, category: ManifestArtifactCategory, filename: string) =>
    invoke<ManifestEntry>("delete_manifest_artifact", { packId, category, filename }),
  restoreManifestArtifact: (packId: string, category: ManifestArtifactCategory, filename: string) =>
    invoke<ManifestEntry>("restore_manifest_artifact", { packId, category, filename }),
  getPublishAuthSettings: () => invoke<PublishAuthSettings>("get_publish_auth_settings"),
  setPublishAuthMethod: (method?: string | null) =>
    invoke<PublishAuthSettings>("set_publish_auth_method", { method }),
  savePublishPat: (token: string) => invoke<PublishAuthSettings>("save_publish_pat", { token }),
  clearPublishPat: () => invoke<PublishAuthSettings>("clear_publish_pat"),
  verifyPublishSsh: () => invoke<PublishSshStatus>("verify_publish_ssh"),
  getPrismSettings: () => invoke<PrismSettings>("get_prism_settings"),
  setPrismSettings: (
    binaryPath?: string | null,
    dataDir?: string | null,
    offlineUsername?: string | null,
    offlineUuid?: string | null,
  ) =>
    invoke<PrismSettings>("set_prism_settings", {
      binaryPath,
      dataDir,
      offlineUsername,
      offlineUuid,
    }),
  fetchMods: (packId: string) => invoke<FetchReport>("fetch_mods", { packId }),
  detectPrism: () => invoke<PrismLocation | null>("detect_prism"),
  getPrismAccountStatus: () => invoke<PrismAccountStatus>("get_prism_account_status"),
  getLaunchProfile: (packId: string) => invoke<LaunchProfile>("get_launch_profile", { packId }),
  getLaunchPresetConfig: (packId: string) =>
    invoke<LaunchPresetConfig>("get_launch_preset_config", { packId }),
  hasManagedJava: (major: number) => invoke<boolean>("has_managed_java", { major }),
  clearOnboardingSettings: (major: number) =>
    invoke<PrismSettings>("clear_onboarding_settings", { major }),
  setLaunchProfile: (packId: string, profile: LaunchProfile) =>
    invoke<LaunchProfile>("set_launch_profile", { packId, profile }),
  installAdoptiumJava: (packId: string, major: number, imageType: string) =>
    invoke<InstalledJavaRuntime>("install_adoptium_java", { packId, major, imageType }),
  installManagedPrism: () => invoke<ManagedPrismInstall>("install_managed_prism"),
  syncInstance: (
    packId: string,
    instanceName?: string,
    syncShaderSettings?: boolean,
    optionPresetId?: string,
    optionSyncCategories?: OptionsSyncCategory[],
  ) =>
    invoke<SyncInstanceReport>("sync_instance", {
      packId,
      instanceName,
      syncShaderSettings,
      optionPresetId,
      optionSyncCategories,
    }),
  launchInstance: (instanceName: string) => invoke<void>("launch_instance", { instanceName }),
  launchPack: (packId: string, instanceName?: string, optionPresetId?: string) =>
    invoke<void>("launch_pack", { packId, instanceName, optionPresetId }),
  setInstanceArtifactDisabled: (
    packId: string,
    category: ManifestArtifactCategory,
    filename: string,
    disabled: boolean,
    instanceName?: string,
  ) =>
    invoke<void>("set_instance_artifact_disabled", {
      packId,
      category,
      filename,
      disabled,
      instanceName,
    }),
  getInstanceMinecraftDir: (instanceName: string) =>
    invoke<string | null>("get_instance_minecraft_dir", { instanceName }),
  deletePrismInstance: (instanceName: string) =>
    invoke<void>("delete_prism_instance", { instanceName }),
  packChangelog: (packId: string, limit?: number, sinceCommit?: string | null) =>
    invoke<PackChangelogEntry[]>("pack_changelog", { packId, limit, sinceCommit }),
  suggestPublishVersion: (packId: string) => invoke<string>("suggest_publish_version", { packId }),
  searchModrinthProjects: (
    packId: string,
    category: ManifestArtifactCategory,
    query?: string,
    page?: number,
    side?: ModrinthSearchSide,
    sort?: ModrinthSearchSort,
  ) =>
    invoke<ModrinthSearchReport>("search_modrinth_projects", {
      packId,
      category,
      query,
      page,
      side,
      sort,
    }),
  listModrinthProjectVersions: (
    packId: string,
    category: ManifestArtifactCategory,
    projectId: string,
  ) =>
    invoke<ModrinthVersionSummary[]>("list_modrinth_project_versions", {
      packId,
      category,
      projectId,
    }),
  listModrinthVersionDependencies: (
    packId: string,
    category: ManifestArtifactCategory,
    versionId: string,
  ) =>
    invoke<ModrinthDependencySummary[]>("list_modrinth_version_dependencies", {
      packId,
      category,
      versionId,
    }),
  previewModrinthMod: (packId: string, identifier: string, category?: ManifestArtifactCategory) =>
    invoke<ModrinthAddPreview>("preview_modrinth_mod", { packId, identifier, category }),
  addModrinthMod: (
    packId: string,
    category: ManifestArtifactCategory,
    projectId: string,
    versionId: string,
    side?: Side,
    installDependencies?: boolean,
  ) =>
    invoke<ManifestEntry>("add_modrinth_mod", {
      packId,
      category,
      projectId,
      versionId,
      side,
      installDependencies,
    }),
  deleteInstanceMod: (
    packId: string,
    filename: string,
    category?: ManifestArtifactCategory,
    instanceName?: string,
  ) => invoke<void>("delete_instance_mod", { packId, filename, category, instanceName }),
  modStatuses: (packId: string, instanceName?: string) =>
    invoke<ModStatus[]>("mod_statuses", { packId, instanceName }),
  scanInstancePublish: (packId: string, instanceName?: string, ignorePatterns?: string[]) =>
    invoke<PublishScanReport>("scan_instance_publish", { packId, instanceName, ignorePatterns }),
  previewOptionsSync: (packId: string, instanceName?: string, optionPresetId?: string) =>
    invoke<OptionsSyncPreview>("preview_options_sync", { packId, instanceName, optionPresetId }),
  previewShaderSettingsSync: (packId: string, instanceName?: string, optionPresetId?: string) =>
    invoke<ShaderSettingsPreview>("preview_shader_settings_sync", {
      packId,
      instanceName,
      optionPresetId,
    }),
  setOptionsSyncIgnored: (packId: string, key: string, ignored: boolean, instanceName?: string) =>
    invoke<string[]>("set_options_sync_ignored", { packId, key, ignored, instanceName }),
  listOptionPresets: (packId: string) =>
    invoke<OptionPresetSummary[]>("list_option_presets", { packId }),
  captureOptionPreset: (packId: string, instanceName?: string) =>
    invoke<OptionPresetCapture>("capture_option_preset", { packId, instanceName }),
  loadOptionPresetForEdit: (packId: string, presetId: string, instanceName?: string) =>
    invoke<OptionPresetEditDraft>("load_option_preset_for_edit", {
      packId,
      presetId,
      instanceName,
    }),
  saveOptionPreset: (packId: string, draft: SaveOptionPresetDraft) =>
    invoke<OptionPresetSummary>("save_option_preset", { packId, draft }),
  applyInstancePublish: (
    packId: string,
    instanceName?: string,
    version?: string,
    ignorePatterns?: string[],
  ) =>
    invoke<PublishApplyReport>("apply_instance_publish", {
      packId,
      instanceName,
      version,
      ignorePatterns,
    }),
  commitAndPushPublish: (
    packId: string,
    message: string,
    ignorePatterns?: string[],
    amendPrevious?: boolean,
  ) =>
    invoke<PublishPushReport>("commit_and_push_publish", {
      packId,
      message,
      ignorePatterns,
      amendPrevious,
    }),
};

export type ModStatusValue =
  | "synced"
  | "local"
  | "outdated"
  | "missing"
  | "deleted"
  | "unpublished"
  | "disabled";
export type ModStatus = {
  id?: string | null;
  filename: string;
  size?: number | null;
  status: ModStatusValue;
};
