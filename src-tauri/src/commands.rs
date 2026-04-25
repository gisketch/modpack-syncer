//! Tauri commands exposed to the frontend.
//! Keep this in sync with `src/lib/tauri.ts`.

use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::{cache, download, git, manifest, paths, prism};

#[derive(Debug, Serialize)]
pub struct PackSummary {
    pub id: String,
    pub url: String,
    pub path: String,
    pub head_sha: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CommandError {
    Git(String),
    Manifest(String),
    Io(String),
    Prism(String),
    Download(String),
    Other(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublishCategory {
    Mods,
    Resourcepacks,
    Shaderpacks,
    Config,
    Kubejs,
    Root,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublishAction {
    Add,
    Update,
    Remove,
    Unchanged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishScanItem {
    pub category: PublishCategory,
    pub relative_path: String,
    pub size: Option<u64>,
    pub sha1: Option<String>,
    pub action: PublishAction,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishScanReport {
    pub instance_dir: String,
    pub items: Vec<PublishScanItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishApplyReport {
    pub manifest_entries_written: usize,
    pub repo_files_written: usize,
    pub repo_files_removed: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishPushReport {
    pub commit_sha: String,
    pub method: String,
}

pub type LaunchProfile = prism::LaunchProfile;
pub type LaunchDefaults = prism::LaunchDefaults;
pub type InstalledJavaRuntime = prism::InstalledJavaRuntime;
pub type JavaInstallProgress = prism::JavaInstallProgress;
pub type ManagedPrismInstall = prism::ManagedPrismInstall;
pub type PrismAccountStatus = prism::PrismAccountStatus;
pub type PrismInstallProgress = prism::PrismInstallProgress;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallProgressEvent {
    pub pack_id: String,
    pub stage: String,
    pub progress: u8,
    pub current_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub log_line: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrismInstallProgressEvent {
    pub stage: String,
    pub progress: u8,
    pub current_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub log_line: Option<String>,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishAuthSettings {
    pub method: Option<String>,
    pub has_pat: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishSshStatus {
    pub verified: bool,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackChangelogItem {
    pub action: PublishAction,
    pub category: PublishCategory,
    pub count: usize,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackChangelogEntry {
    pub commit_sha: String,
    pub pack_version: String,
    pub title: String,
    pub description: String,
    pub committed_at: i64,
    pub items: Vec<PackChangelogItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthAddPreview {
    pub project_id: String,
    pub version_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub version_number: String,
    pub filename: String,
    pub size: u64,
    pub url: String,
    pub sha1: String,
    pub sha512: Option<String>,
    pub suggested_side: manifest::Side,
    pub already_tracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnpublishedModrinthState {
    filename: String,
    project_id: String,
    version_id: String,
    slug: String,
    url: String,
    sha1: String,
    sha512: Option<String>,
    size: u64,
    side: manifest::Side,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthProjectApi {
    id: String,
    slug: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    icon_url: Option<String>,
    client_side: String,
    server_side: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthVersionApi {
    id: String,
    version_number: String,
    files: Vec<ModrinthVersionFileApi>,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthVersionFileApi {
    url: String,
    filename: String,
    size: u64,
    #[serde(default)]
    primary: bool,
    hashes: ModrinthHashesApi,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthHashesApi {
    sha1: String,
    #[serde(default)]
    sha512: Option<String>,
}

impl From<git::GitError> for CommandError {
    fn from(e: git::GitError) -> Self {
        Self::Git(e.to_string())
    }
}
impl From<git2::Error> for CommandError {
    fn from(e: git2::Error) -> Self {
        Self::Git(e.to_string())
    }
}
impl From<manifest::ManifestError> for CommandError {
    fn from(e: manifest::ManifestError) -> Self {
        Self::Manifest(e.to_string())
    }
}
impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}
impl From<anyhow::Error> for CommandError {
    fn from(e: anyhow::Error) -> Self {
        Self::Other(e.to_string())
    }
}
impl From<prism::PrismError> for CommandError {
    fn from(e: prism::PrismError) -> Self {
        Self::Prism(e.to_string())
    }
}
impl From<download::DownloadError> for CommandError {
    fn from(e: download::DownloadError) -> Self {
        Self::Download(e.to_string())
    }
}

#[tauri::command]
pub async fn get_publish_auth_settings() -> Result<PublishAuthSettings, CommandError> {
    let path = paths::publish_auth_path()?;
    let method = if path.exists() {
        let bytes = std::fs::read(path)?;
        serde_json::from_slice::<PublishAuthSettings>(&bytes)
            .ok()
            .and_then(|settings| settings.method)
    } else {
        None
    };
    Ok(PublishAuthSettings {
        method,
        has_pat: crate::keychain::load_github_pat()?.is_some(),
    })
}

#[tauri::command]
pub async fn set_publish_auth_method(method: Option<String>) -> Result<PublishAuthSettings, CommandError> {
    let path = paths::publish_auth_path()?;
    let settings = PublishAuthSettings {
        method,
        has_pat: crate::keychain::load_github_pat()?.is_some(),
    };
    let bytes = serde_json::to_vec_pretty(&settings).map_err(anyhow::Error::from)?;
    std::fs::write(&path, bytes)?;
    Ok(settings)
}

#[tauri::command]
pub async fn save_publish_pat(token: String) -> Result<PublishAuthSettings, CommandError> {
    crate::keychain::save_github_pat(&token)?;
    let method = get_publish_auth_settings().await?.method;
    Ok(PublishAuthSettings {
        method,
        has_pat: true,
    })
}

#[tauri::command]
pub async fn clear_publish_pat() -> Result<PublishAuthSettings, CommandError> {
    crate::keychain::clear_github_pat()?;
    let method = get_publish_auth_settings().await?.method;
    Ok(PublishAuthSettings {
        method,
        has_pat: false,
    })
}

#[tauri::command]
pub async fn verify_publish_ssh() -> Result<PublishSshStatus, CommandError> {
    match tokio::task::spawn_blocking(git::verify_ssh_access)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
    {
        Ok(access) => Ok(PublishSshStatus {
            verified: true,
            source: Some(access.source),
        }),
        Err(err) => Err(CommandError::Git(err.to_string())),
    }
}

#[tauri::command]
pub async fn get_prism_settings() -> Result<prism::PrismSettings, CommandError> {
    tokio::task::spawn_blocking(prism::get_settings)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_launch_defaults() -> Result<LaunchDefaults, CommandError> {
    tokio::task::spawn_blocking(prism::get_launch_defaults)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_launch_defaults(defaults: LaunchDefaults) -> Result<LaunchDefaults, CommandError> {
    tokio::task::spawn_blocking(move || prism::save_launch_defaults(defaults))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_app_storage_settings() -> Result<paths::AppStorageSettings, CommandError> {
    tokio::task::spawn_blocking(paths::get_app_storage_settings)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_app_storage_settings(
    override_data_dir: Option<String>,
) -> Result<paths::AppStorageSettings, CommandError> {
    let override_data_dir = override_data_dir.and_then(normalize_optional_path);
    tokio::task::spawn_blocking(move || paths::set_app_storage_settings(override_data_dir, true))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_prism_settings(
    binary_path: Option<String>,
    data_dir: Option<String>,
    offline_username: Option<String>,
) -> Result<prism::PrismSettings, CommandError> {
    let settings = prism::PrismSettings {
        binary_path: binary_path.and_then(normalize_optional_path),
        data_dir: data_dir.and_then(normalize_optional_path),
        offline_username: offline_username.and_then(normalize_optional_text),
    };
    tokio::task::spawn_blocking(move || prism::save_settings(settings))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn add_pack(url: String) -> Result<PackSummary, CommandError> {
    let id = paths::pack_id_from_url(&url);
    let dest = paths::packs_dir()?.join(&id);
    let url_clone = url.clone();
    let dest_clone = dest.clone();
    // libgit2 is blocking; run off the async runtime.
    let head = tokio::task::spawn_blocking(move || git::clone_or_update(&url_clone, &dest_clone))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(PackSummary {
        id,
        url,
        path: dest.display().to_string(),
        head_sha: head,
    })
}

#[tauri::command]
pub async fn list_packs() -> Result<Vec<PackSummary>, CommandError> {
    let root = paths::packs_dir()?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() || !path.join(".git").exists() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let head_sha = git::head_sha(&path).unwrap_or_default();
        out.push(PackSummary {
            id,
            url: String::new(),
            path: path.display().to_string(),
            head_sha,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn update_pack(pack_id: String) -> Result<PackSummary, CommandError> {
    let dest = paths::packs_dir()?.join(&pack_id);
    let dest_clone = dest.clone();
    let head = tokio::task::spawn_blocking(move || git::update(&dest_clone))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;

    Ok(PackSummary {
        id: pack_id,
        url: String::new(),
        path: dest.display().to_string(),
        head_sha: head,
    })
}

#[tauri::command]
pub async fn load_manifest(pack_id: String) -> Result<manifest::Manifest, CommandError> {
    let path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let m = tokio::task::spawn_blocking(move || manifest::load_from_path(&path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(m)
}

#[tauri::command]
pub async fn fetch_mods(pack_id: String) -> Result<download::FetchReport, CommandError> {
    let path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let m = tokio::task::spawn_blocking(move || manifest::load_from_path(&path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    let report = download::fetch_all(
        m.mods
            .into_iter()
            .filter(|entry| entry.source != manifest::Source::Repo)
            .collect(),
    )
    .await;
    Ok(report)
}

#[tauri::command]
pub async fn detect_prism() -> Result<Option<prism::PrismLocation>, CommandError> {
    Ok(prism::location())
}

#[tauri::command]
pub async fn get_prism_account_status() -> Result<PrismAccountStatus, CommandError> {
    tokio::task::spawn_blocking(prism::read_account_status)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_launch_profile(pack_id: String) -> Result<LaunchProfile, CommandError> {
    tokio::task::spawn_blocking(move || prism::load_launch_profile(&pack_id))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn has_managed_java(major: u32) -> Result<bool, CommandError> {
    tokio::task::spawn_blocking(move || prism::has_managed_java(major))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn clear_onboarding_settings(major: u32) -> Result<prism::PrismSettings, CommandError> {
    tokio::task::spawn_blocking(move || prism::clear_onboarding_settings(major))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_launch_profile(pack_id: String, profile: LaunchProfile) -> Result<LaunchProfile, CommandError> {
    tokio::task::spawn_blocking(move || prism::save_launch_profile(&pack_id, &profile))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn install_adoptium_java(
    app: tauri::AppHandle,
    pack_id: String,
    major: u32,
    image_type: String,
) -> Result<InstalledJavaRuntime, CommandError> {
    prism::install_adoptium_java(major, &image_type, |progress: JavaInstallProgress| {
        let _ = app.emit(
            "java-install-progress",
            JavaInstallProgressEvent {
                pack_id: pack_id.clone(),
                stage: progress.stage,
                progress: progress.progress,
                current_bytes: progress.current_bytes,
                total_bytes: progress.total_bytes,
                log_line: progress.log_line,
            },
        );
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn install_managed_prism(app: tauri::AppHandle) -> Result<ManagedPrismInstall, CommandError> {
    prism::install_managed_prism(|progress: PrismInstallProgress| {
        let _ = app.emit(
            "prism-install-progress",
            PrismInstallProgressEvent {
                stage: progress.stage,
                progress: progress.progress,
                current_bytes: progress.current_bytes,
                total_bytes: progress.total_bytes,
                log_line: progress.log_line,
            },
        );
    })
    .await
    .map_err(CommandError::from)
}

#[derive(Debug, Serialize)]
pub struct SyncInstanceReport {
    pub fetch: download::FetchReport,
    pub instance: prism::InstanceWriteReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgressEvent {
    pack_id: String,
    filename: Option<String>,
    status: &'static str,
    completed: usize,
    total: usize,
    cached: usize,
    downloaded: usize,
    failures: usize,
}

#[tauri::command]
pub async fn sync_instance(
    app: tauri::AppHandle,
    pack_id: String,
    instance_name: Option<String>,
) -> Result<SyncInstanceReport, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let m = tokio::task::spawn_blocking({
        let manifest_path = manifest_path.clone();
        move || manifest::load_from_path(&manifest_path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let remote_mods = m
        .mods
        .iter()
        .filter(|entry| entry.source != manifest::Source::Repo)
        .cloned()
        .collect::<Vec<_>>();

    let fetch_report = download::fetch_all_with_progress(remote_mods, {
        let app = app.clone();
        let pack_id = pack_id.clone();
        move |progress| {
            let _ = app.emit(
                "sync-progress",
                SyncProgressEvent {
                    pack_id: pack_id.clone(),
                    filename: Some(progress.filename),
                    status: progress.status,
                    completed: progress.completed,
                    total: progress.total,
                    cached: progress.cached,
                    downloaded: progress.downloaded,
                    failures: progress.failures,
                },
            );
        }
    })
    .await;
    if !fetch_report.failures.is_empty() {
        let _ = app.emit(
            "sync-progress",
            SyncProgressEvent {
                pack_id: pack_id.clone(),
                filename: None,
                status: "failed",
                completed: fetch_report.cached + fetch_report.downloaded + fetch_report.failures.len(),
                total: fetch_report.total,
                cached: fetch_report.cached,
                downloaded: fetch_report.downloaded,
                failures: fetch_report.failures.len(),
            },
        );
        return Err(CommandError::Download(format!(
            "{} mod(s) failed: {}",
            fetch_report.failures.len(),
            fetch_report.failures.join("; ")
        )));
    }

    let resolved_mods = resolve_entries(&pack_dir, &m.mods)?;
    let resolved_resourcepacks = resolve_entries(&pack_dir, &m.resourcepacks)?;
    let resolved_shaderpacks = resolve_entries(&pack_dir, &m.shaderpacks)?;
    let launch_profile = prism::load_launch_profile(&pack_id)?;

    let inst_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            pack_id: pack_id.clone(),
            filename: None,
            status: "writing-instance",
            completed: fetch_report.cached + fetch_report.downloaded,
            total: fetch_report.total,
            cached: fetch_report.cached,
            downloaded: fetch_report.downloaded,
            failures: fetch_report.failures.len(),
        },
    );
    let pack_dir_clone = pack_dir.clone();
    let manifest_clone = m.clone();
    let inst_name_clone = inst_name.clone();
    let inst_report = tokio::task::spawn_blocking(move || {
        prism::write_instance(
            &inst_name_clone,
            &manifest_clone,
            &resolved_mods,
            &resolved_resourcepacks,
            &resolved_shaderpacks,
            &pack_dir_clone,
            Some(&launch_profile),
        )
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let _ = app.emit(
        "sync-progress",
        SyncProgressEvent {
            pack_id: pack_id.clone(),
            filename: None,
            status: "done",
            completed: fetch_report.total,
            total: fetch_report.total,
            cached: fetch_report.cached,
            downloaded: fetch_report.downloaded,
            failures: fetch_report.failures.len(),
        },
    );

    Ok(SyncInstanceReport {
        fetch: fetch_report,
        instance: inst_report,
    })
}

fn resolve_entries(
    pack_dir: &std::path::Path,
    entries: &[manifest::Entry],
) -> Result<Vec<(std::path::PathBuf, String)>, CommandError> {
    entries
        .iter()
        .map(|entry| {
            let path = match entry.source {
                manifest::Source::Repo => {
                    let repo_path = entry.repo_path.as_ref().ok_or_else(|| {
                        CommandError::Manifest(format!(
                            "repo entry {} missing repoPath",
                            entry.filename
                        ))
                    })?;
                    pack_dir.join(repo_path)
                }
                _ => cache::path_for(&entry.sha1)?,
            };
            if !path.exists() {
                return Err(CommandError::Manifest(format!(
                    "artifact missing for {} at {}",
                    entry.filename,
                    path.display()
                )));
            }
            download::verify_file(&path, entry)?;
            Ok((path, entry.filename.clone()))
        })
        .collect()
}

#[tauri::command]
pub async fn launch_instance(instance_name: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || prism::launch(&instance_name))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(())
}

#[tauri::command]
pub async fn launch_pack(pack_id: String, instance_name: Option<String>) -> Result<(), CommandError> {
    let launch_profile = prism::load_launch_profile(&pack_id)?;
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));

    let apply_instance_name = instance_name.clone();
    let apply_launch_profile = launch_profile.clone();
    tokio::task::spawn_blocking(move || prism::apply_launch_profile(&apply_instance_name, &apply_launch_profile))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;

    tokio::task::spawn_blocking(move || prism::launch(&instance_name))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(())
}

#[tauri::command]
pub async fn get_instance_minecraft_dir(instance_name: String) -> Result<Option<String>, CommandError> {
    Ok(prism::instance_minecraft_dir(&instance_name).map(|path| path.display().to_string()))
}

#[tauri::command]
pub async fn pack_changelog(
    pack_id: String,
    limit: Option<usize>,
    since_commit: Option<String>,
) -> Result<Vec<PackChangelogEntry>, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let limit = limit.unwrap_or(12);
    tokio::task::spawn_blocking(move || load_pack_changelog(&pack_dir, limit, since_commit.as_deref()))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn suggest_publish_version(pack_id: String) -> Result<String, CommandError> {
    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(next_publish_version(&manifest.pack.version))
}

#[tauri::command]
pub async fn preview_modrinth_mod(
    pack_id: String,
    identifier: String,
) -> Result<ModrinthAddPreview, CommandError> {
    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    resolve_modrinth_preview(&manifest, &identifier).await
}

#[tauri::command]
pub async fn add_modrinth_mod(
    pack_id: String,
    project_id: String,
    version_id: String,
    side: Option<String>,
) -> Result<manifest::Entry, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let manifest_path = manifest_path.clone();
        move || manifest::load_from_path(&manifest_path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let preview = resolve_modrinth_preview_from_ids(&manifest, &project_id, &version_id).await?;
    let chosen_side = side
        .as_deref()
        .map(parse_manifest_side)
        .transpose()?
        .unwrap_or(preview.suggested_side);

    let next_entry = manifest::Entry {
        id: preview.slug.clone(),
        source: manifest::Source::Modrinth,
        project_id: Some(preview.project_id.clone()),
        version_id: Some(preview.version_id.clone()),
        repo_path: None,
        filename: preview.filename.clone(),
        sha1: preview.sha1.clone(),
        sha512: preview.sha512.clone(),
        size: preview.size,
        url: preview.url.clone(),
        optional: false,
        side: chosen_side,
    };
    let cached_path = download::fetch_entry(&next_entry).await?;
    let instance_name = format!("modsync-{pack_id}");
    let mods_dir = prism::instance_mods_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;

    tokio::task::spawn_blocking(move || -> Result<manifest::Entry, CommandError> {
        std::fs::create_dir_all(&mods_dir)?;
        copy_local_file(&cached_path, &mods_dir.join(&next_entry.filename))?;

        let mut state = read_unpublished_modrinth_state(&mods_dir)?;
        state.retain(|entry| entry.filename != next_entry.filename);
        state.push(UnpublishedModrinthState {
            filename: next_entry.filename.clone(),
            project_id: preview.project_id,
            version_id: preview.version_id,
            slug: preview.slug,
            url: next_entry.url.clone(),
            sha1: next_entry.sha1.clone(),
            sha512: next_entry.sha512.clone(),
            size: next_entry.size,
            side: next_entry.side,
        });
        state.sort_by(|left, right| left.filename.cmp(&right.filename));
        write_unpublished_modrinth_state(&mods_dir, &state)?;
        Ok(next_entry)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn delete_instance_mod(
    pack_id: String,
    filename: String,
    instance_name: Option<String>,
) -> Result<(), CommandError> {
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let mods_dir = prism::instance_mods_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        let path = mods_dir.join(&filename);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        let mut state = read_unpublished_modrinth_state(&mods_dir)?;
        state.retain(|entry| entry.filename != filename);
        write_unpublished_modrinth_state(&mods_dir, &state)?;
        Ok(())
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn scan_instance_publish(
    pack_id: String,
    instance_name: Option<String>,
) -> Result<PublishScanReport, CommandError> {
    use std::collections::HashSet;

    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let p = manifest_path.clone();
        move || manifest::load_from_path(&p)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_dir = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let instance_dir_for_scan = instance_dir.clone();

    tokio::task::spawn_blocking(move || -> Result<PublishScanReport, CommandError> {
        let mut items = Vec::new();
        items.extend(scan_artifact_dir(
            PublishCategory::Mods,
            &instance_dir_for_scan.join("mods"),
            &manifest.mods,
        )?);
        items.extend(scan_artifact_dir(
            PublishCategory::Resourcepacks,
            &instance_dir_for_scan.join("resourcepacks"),
            &manifest.resourcepacks,
        )?);
        items.extend(scan_artifact_dir(
            PublishCategory::Shaderpacks,
            &instance_dir_for_scan.join("shaderpacks"),
            &manifest.shaderpacks,
        )?);
        items.extend(scan_tree_dir(
            PublishCategory::Config,
            &instance_dir_for_scan.join("config"),
            &pack_dir.join("configs"),
        )?);
        items.extend(scan_tree_dir(
            PublishCategory::Kubejs,
            &instance_dir_for_scan.join("kubejs"),
            &pack_dir.join("kubejs"),
        )?);
        items.extend(scan_root_files(
            &instance_dir_for_scan,
            &pack_dir,
            &["options.txt"],
        )?);

        let mut seen = HashSet::new();
        items.retain(|item| {
            seen.insert((item.relative_path.clone(), format!("{:?}", item.category)))
        });

        Ok(PublishScanReport {
            instance_dir: instance_dir_for_scan.display().to_string(),
            items,
        })
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn commit_and_push_publish(
    pack_id: String,
    message: String,
) -> Result<PublishPushReport, CommandError> {
    eprintln!("[modsync] publish push command: start for {pack_id}");
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let settings = read_publish_auth_settings()?;
    let method = settings.method.unwrap_or_else(|| {
        if settings.has_pat {
            "pat".to_string()
        } else {
            "ssh".to_string()
        }
    });
    let auth = match method.as_str() {
        "pat" => {
            let token = crate::keychain::load_github_pat()?
                .ok_or_else(|| CommandError::Other("PAT mode selected but no token stored".to_string()))?;
            git::PushAuth::Pat(token)
        }
        "ssh" => git::PushAuth::Ssh,
        other => {
            return Err(CommandError::Other(format!(
                "unsupported publish auth method: {other}"
            )))
        }
    };

    let commit_sha = tokio::time::timeout(
        std::time::Duration::from_secs(45),
        tokio::task::spawn_blocking(move || git::commit_and_push(&pack_dir, &message, auth)),
    )
    .await
    .map_err(|_| CommandError::Git("publish push timed out after 45s".to_string()))?
    .map_err(|e| CommandError::Other(e.to_string()))??;

    eprintln!("[modsync] publish push command: done {commit_sha}");
    Ok(PublishPushReport { commit_sha, method })
}

#[tauri::command]
pub async fn apply_instance_publish(
    pack_id: String,
    instance_name: Option<String>,
    version: Option<String>,
) -> Result<PublishApplyReport, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let p = manifest_path.clone();
        move || manifest::load_from_path(&p)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_dir = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let unpublished_modrinth = read_unpublished_modrinth_state(&instance_dir.join("mods"))?;

    tokio::task::spawn_blocking(move || -> Result<PublishApplyReport, CommandError> {
        let mut manifest = manifest;
        let final_version = version
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| next_publish_version(&manifest.pack.version));
        manifest.pack.version = final_version;
        let mut repo_files_written = 0usize;
        let mut repo_files_removed = 0usize;

        apply_artifact_dir(
            &instance_dir.join("mods"),
            &pack_dir.join("mods"),
            "mods",
            &mut manifest.mods,
            Some(&unpublished_modrinth),
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_artifact_dir(
            &instance_dir.join("resourcepacks"),
            &pack_dir.join("resourcepacks"),
            "resourcepacks",
            &mut manifest.resourcepacks,
            None,
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_artifact_dir(
            &instance_dir.join("shaderpacks"),
            &pack_dir.join("shaderpacks"),
            "shaderpacks",
            &mut manifest.shaderpacks,
            None,
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;

        apply_tree_dir(
            &instance_dir.join("config"),
            &pack_dir.join("configs"),
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_tree_dir(
            &instance_dir.join("kubejs"),
            &pack_dir.join("kubejs"),
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_root_files(
            &instance_dir,
            &pack_dir,
            &["options.txt"],
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;

        let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(anyhow::Error::from)?;
        std::fs::write(&manifest_path, manifest_bytes)?;

        Ok(PublishApplyReport {
            manifest_entries_written: manifest.mods.len()
                + manifest.resourcepacks.len()
                + manifest.shaderpacks.len(),
            repo_files_written,
            repo_files_removed,
        })
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[derive(Debug, Serialize)]
pub struct ModStatus {
    pub id: Option<String>,
    pub filename: String,
    pub size: Option<u64>,
    pub status: &'static str, // "synced" | "outdated" | "missing" | "deleted" | "unpublished"
}

#[tauri::command]
pub async fn mod_statuses(
    pack_id: String,
    instance_name: Option<String>,
) -> Result<Vec<ModStatus>, CommandError> {
    use sha1::{Digest as _, Sha1};
    use std::collections::{HashMap, HashSet};

    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let m = tokio::task::spawn_blocking({
        let p = manifest_path.clone();
        move || manifest::load_from_path(&p)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;
    let previous_manifest = tokio::task::spawn_blocking({
        let pack_dir = pack_dir.clone();
        move || -> Result<Option<manifest::Manifest>, CommandError> {
            let Some(bytes) = git::read_head_parent_file(&pack_dir, "manifest.json")? else {
                return Ok(None);
            };
            let parsed = serde_json::from_slice::<manifest::Manifest>(&bytes).ok();
            Ok(parsed)
        }
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let inst_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let mods_dir_opt = prism::instance_mods_dir(&inst_name);

    tokio::task::spawn_blocking(move || {
        let manifest_filenames = m
            .mods
            .iter()
            .map(|entry| entry.filename.clone())
            .collect::<HashSet<_>>();
        let mut out = Vec::with_capacity(m.mods.len());
        let previous_state = mods_dir_opt
            .as_ref()
            .map(|dir| prism::read_managed_mod_state(dir))
            .transpose()?
            .unwrap_or_default();
        let previous_by_id = previous_state
            .iter()
            .map(|entry| (entry.id.as_str(), entry))
            .collect::<HashMap<_, _>>();
        let previous_manifest_by_id = previous_manifest
            .as_ref()
            .map(|manifest| {
                manifest
                    .mods
                    .iter()
                    .map(|entry| (entry.id.as_str(), entry))
                    .collect::<HashMap<_, _>>()
            })
            .unwrap_or_default();
        let updated_old_filenames = m
            .mods
            .iter()
            .filter_map(|entry| {
                previous_manifest_by_id
                    .get(entry.id.as_str())
                    .filter(|prev| prev.filename != entry.filename)
                    .map(|prev| prev.filename.clone())
            })
            .collect::<HashSet<_>>();

        for e in &m.mods {
            let status = match &mods_dir_opt {
                None => "missing",
                Some(dir) => {
                    let p = dir.join(&e.filename);
                    if p.exists() {
                        match std::fs::read(&p) {
                            Ok(bytes) => {
                                let got = hex::encode(Sha1::digest(&bytes));
                                if got.eq_ignore_ascii_case(&e.sha1) {
                                    "synced"
                                } else {
                                    "outdated"
                                }
                            }
                            Err(_) => "missing",
                        }
                    } else if let Some(previous) = previous_by_id.get(e.id.as_str()) {
                        if dir.join(&previous.filename).exists() {
                            "outdated"
                        } else {
                            "missing"
                        }
                    } else if let Some(previous) = previous_manifest_by_id.get(e.id.as_str()) {
                        if previous.filename != e.filename && dir.join(&previous.filename).exists() {
                            "outdated"
                        } else {
                            "missing"
                        }
                    } else {
                        "missing"
                    }
                }
            };
            out.push(ModStatus {
                id: Some(e.id.clone()),
                filename: e.filename.clone(),
                size: Some(e.size as u64),
                status,
            });
        }

        if let Some(dir) = &mods_dir_opt {
            let mut seen_extra_filenames = HashSet::new();
            for path in list_regular_files(dir)? {
                let filename = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .ok_or_else(|| CommandError::Other("invalid unicode filename".to_string()))?
                    .to_string();

                if manifest_filenames.contains(&filename)
                    || updated_old_filenames.contains(&filename)
                    || !seen_extra_filenames.insert(filename.clone())
                {
                    continue;
                }

                out.push(ModStatus {
                    id: None,
                    filename,
                    size: path.metadata().ok().map(|meta| meta.len()),
                    status: "unpublished",
                });
            }
        }

        Ok(out)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

fn scan_artifact_dir(
    category: PublishCategory,
    instance_dir: &std::path::Path,
    entries: &[manifest::Entry],
) -> Result<Vec<PublishScanItem>, CommandError> {
    use std::collections::{HashMap, HashSet};

    let baseline = entries
        .iter()
        .map(|entry| (entry.filename.clone(), entry))
        .collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for path in list_regular_files(instance_dir)? {
        let filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| CommandError::Other("invalid unicode filename".to_string()))?
            .to_string();
        let sha1 = cache::file_sha1_hex(&path)?;
        let size = path.metadata()?.len();
        let (action, source) = match baseline.get(&filename) {
            Some(entry) if entry.sha1.eq_ignore_ascii_case(&sha1) => {
                (PublishAction::Unchanged, Some(source_label(entry.source)))
            }
            Some(entry) => (PublishAction::Update, Some(source_label(entry.source))),
            None => (PublishAction::Add, None),
        };
        seen.insert(filename.clone());
        out.push(PublishScanItem {
            category: category.clone(),
            relative_path: filename,
            size: Some(size),
            sha1: Some(sha1),
            action,
            source,
        });
    }

    for entry in entries {
        if !seen.contains(&entry.filename) {
            out.push(PublishScanItem {
                category: category.clone(),
                relative_path: entry.filename.clone(),
                size: Some(entry.size),
                sha1: Some(entry.sha1.clone()),
                action: PublishAction::Remove,
                source: Some(source_label(entry.source)),
            });
        }
    }

    Ok(out)
}

fn scan_tree_dir(
    category: PublishCategory,
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
) -> Result<Vec<PublishScanItem>, CommandError> {
    use std::collections::{HashMap, HashSet};

    let instance = list_relative_regular_files(instance_dir)?;
    let repo = list_relative_regular_files(repo_dir)?;
    let repo_map = repo.into_iter().collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for (rel, path) in instance {
        let sha1 = cache::file_sha1_hex(&path)?;
        let size = path.metadata()?.len();
        let action = match repo_map.get(&rel) {
            Some(repo_path) if cache::file_sha1_hex(repo_path)? == sha1 => PublishAction::Unchanged,
            Some(_) => PublishAction::Update,
            None => PublishAction::Add,
        };
        seen.insert(rel.clone());
        out.push(PublishScanItem {
            category: category.clone(),
            relative_path: rel,
            size: Some(size),
            sha1: Some(sha1),
            action,
            source: Some("repo-tree".to_string()),
        });
    }

    for (rel, repo_path) in repo_map {
        if !seen.contains(&rel) {
            out.push(PublishScanItem {
                category: category.clone(),
                relative_path: rel,
                size: Some(repo_path.metadata()?.len()),
                sha1: Some(cache::file_sha1_hex(&repo_path)?),
                action: PublishAction::Remove,
                source: Some("repo-tree".to_string()),
            });
        }
    }

    Ok(out)
}

fn scan_root_files(
    instance_root: &std::path::Path,
    repo_root: &std::path::Path,
    whitelist: &[&str],
) -> Result<Vec<PublishScanItem>, CommandError> {
    let mut out = Vec::new();
    for rel in whitelist {
        let instance_path = instance_root.join(rel);
        let repo_path = repo_root.join(rel);
        match (instance_path.exists(), repo_path.exists()) {
            (true, true) => {
                let instance_sha1 = cache::file_sha1_hex(&instance_path)?;
                let repo_sha1 = cache::file_sha1_hex(&repo_path)?;
                out.push(PublishScanItem {
                    category: PublishCategory::Root,
                    relative_path: (*rel).to_string(),
                    size: Some(instance_path.metadata()?.len()),
                    sha1: Some(instance_sha1),
                    action: if repo_sha1 == cache::file_sha1_hex(&instance_path)? {
                        PublishAction::Unchanged
                    } else {
                        PublishAction::Update
                    },
                    source: Some("repo-tree".to_string()),
                });
            }
            (true, false) => out.push(PublishScanItem {
                category: PublishCategory::Root,
                relative_path: (*rel).to_string(),
                size: Some(instance_path.metadata()?.len()),
                sha1: Some(cache::file_sha1_hex(&instance_path)?),
                action: PublishAction::Add,
                source: Some("repo-tree".to_string()),
            }),
            (false, true) => out.push(PublishScanItem {
                category: PublishCategory::Root,
                relative_path: (*rel).to_string(),
                size: Some(repo_path.metadata()?.len()),
                sha1: Some(cache::file_sha1_hex(&repo_path)?),
                action: PublishAction::Remove,
                source: Some("repo-tree".to_string()),
            }),
            (false, false) => {}
        }
    }
    Ok(out)
}

fn list_regular_files(root: &std::path::Path) -> Result<Vec<std::path::PathBuf>, CommandError> {
    let mut out = Vec::new();
    if !root.exists() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file()
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| !name.starts_with('.'))
        {
            out.push(path);
        }
    }
    Ok(out)
}

fn list_relative_regular_files(
    root: &std::path::Path,
) -> Result<Vec<(String, std::path::PathBuf)>, CommandError> {
    let mut out = Vec::new();
    if !root.exists() {
        return Ok(out);
    }
    collect_relative_regular_files(root, root, &mut out)?;
    Ok(out)
}

fn collect_relative_regular_files(
    root: &std::path::Path,
    current: &std::path::Path,
    out: &mut Vec<(String, std::path::PathBuf)>,
) -> Result<(), CommandError> {
    for entry in std::fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_relative_regular_files(root, &path, out)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(root)
                .map_err(|e| CommandError::Other(e.to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            out.push((rel, path));
        }
    }
    Ok(())
}

fn source_label(source: manifest::Source) -> String {
    match source {
        manifest::Source::Modrinth => "modrinth",
        manifest::Source::Curseforge => "curseforge",
        manifest::Source::Url => "url",
        manifest::Source::Repo => "repo",
    }
    .to_string()
}

fn read_publish_auth_settings() -> Result<PublishAuthSettings, CommandError> {
    let path = paths::publish_auth_path()?;
    let method = if path.exists() {
        let bytes = std::fs::read(path)?;
        serde_json::from_slice::<PublishAuthSettings>(&bytes)
            .ok()
            .and_then(|settings| settings.method)
    } else {
        None
    };
    Ok(PublishAuthSettings {
        method,
        has_pat: crate::keychain::load_github_pat()?.is_some(),
    })
}

fn normalize_optional_path(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_optional_text(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn apply_artifact_dir(
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
    repo_prefix: &str,
    entries: &mut Vec<manifest::Entry>,
    unpublished_modrinth: Option<&[UnpublishedModrinthState]>,
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
) -> Result<(), CommandError> {
    use std::collections::{HashMap, HashSet};

    let instance_files = list_regular_files(instance_dir)?;
    let mut existing_by_filename = entries
        .iter()
        .cloned()
        .map(|entry| (entry.filename.clone(), entry))
        .collect::<HashMap<_, _>>();
    let mut used_ids = entries
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<HashSet<_>>();
    let unpublished_by_filename = unpublished_modrinth
        .unwrap_or(&[])
        .iter()
        .map(|entry| (entry.filename.as_str(), entry))
        .collect::<HashMap<_, _>>();
    let mut next_entries = Vec::with_capacity(instance_files.len());
    let mut seen_filenames = HashSet::new();

    for path in instance_files {
        let filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| CommandError::Other("invalid unicode filename".to_string()))?
            .to_string();
        let sha1 = cache::file_sha1_hex(&path)?;
        let size = path.metadata()?.len();
        let existing = existing_by_filename.remove(&filename);
        let unpublished = unpublished_by_filename
            .get(filename.as_str())
            .filter(|entry| entry.sha1.eq_ignore_ascii_case(&sha1));
        let needs_repo_copy = if unpublished.is_some() {
            false
        } else {
            !matches!(
                &existing,
                Some(entry) if entry.sha1.eq_ignore_ascii_case(&sha1) && entry.source != manifest::Source::Repo
            )
        };
        let mut entry = if let Some(unpublished) = unpublished {
            manifest::Entry {
                id: unpublished.slug.clone(),
                source: manifest::Source::Modrinth,
                project_id: Some(unpublished.project_id.clone()),
                version_id: Some(unpublished.version_id.clone()),
                repo_path: None,
                filename: filename.clone(),
                sha1: unpublished.sha1.clone(),
                sha512: unpublished.sha512.clone(),
                size: unpublished.size,
                url: unpublished.url.clone(),
                optional: false,
                side: unpublished.side,
            }
        } else {
            existing.unwrap_or_else(|| manifest::Entry {
                id: unique_local_id(repo_prefix, &filename, &mut used_ids),
                source: manifest::Source::Repo,
                project_id: None,
                version_id: None,
                repo_path: None,
                filename: filename.clone(),
                sha1: sha1.clone(),
                sha512: None,
                size,
                url: String::new(),
                optional: false,
                side: manifest::Side::Client,
            })
        };

        if needs_repo_copy {
            let repo_path = entry
                .repo_path
                .clone()
                .unwrap_or_else(|| format!("{repo_prefix}/{filename}"));
            copy_file_to_repo(&path, &repo_dir.join(&filename))?;
            *repo_files_written += 1;
            entry.source = manifest::Source::Repo;
            entry.project_id = None;
            entry.version_id = None;
            entry.repo_path = Some(repo_path);
            entry.url.clear();
        }

        entry.filename = filename.clone();
        entry.sha1 = sha1;
        entry.sha512 = None;
        entry.size = size;
        seen_filenames.insert(filename);
        next_entries.push(entry);
    }

    for entry in existing_by_filename.into_values() {
        if seen_filenames.contains(&entry.filename) {
            continue;
        }
        if let Some(repo_path) = entry.repo_path {
            let target = repo_dir.parent().unwrap_or(repo_dir).join(repo_path);
            if remove_path_if_exists(&target)? {
                *repo_files_removed += 1;
            }
        }
    }

    next_entries.sort_by(|left, right| left.filename.cmp(&right.filename));
    *entries = next_entries;
    Ok(())
}

fn apply_tree_dir(
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
) -> Result<(), CommandError> {
    use std::collections::{HashMap, HashSet};

    let instance_files = list_relative_regular_files(instance_dir)?;
    let repo_files = list_relative_regular_files(repo_dir)?;
    let repo_map = repo_files.into_iter().collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();

    for (rel, path) in instance_files {
        seen.insert(rel.clone());
        copy_file_to_repo(&path, &repo_dir.join(&rel))?;
        *repo_files_written += 1;
    }

    for (rel, path) in repo_map {
        if seen.contains(&rel) {
            continue;
        }
        if remove_path_if_exists(&path)? {
            *repo_files_removed += 1;
        }
    }

    Ok(())
}

fn apply_root_files(
    instance_root: &std::path::Path,
    repo_root: &std::path::Path,
    whitelist: &[&str],
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
) -> Result<(), CommandError> {
    for rel in whitelist {
        let instance_path = instance_root.join(rel);
        let repo_path = repo_root.join(rel);
        if instance_path.exists() {
            copy_file_to_repo(&instance_path, &repo_path)?;
            *repo_files_written += 1;
        } else if remove_path_if_exists(&repo_path)? {
            *repo_files_removed += 1;
        }
    }
    Ok(())
}

fn copy_file_to_repo(src: &std::path::Path, dst: &std::path::Path) -> Result<(), CommandError> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(src, dst)?;
    Ok(())
}

fn remove_path_if_exists(path: &std::path::Path) -> Result<bool, CommandError> {
    if !path.exists() {
        return Ok(false);
    }
    std::fs::remove_file(path)?;
    Ok(true)
}

fn unique_local_id(prefix: &str, filename: &str, used_ids: &mut std::collections::HashSet<String>) -> String {
    let stem = filename
        .rsplit_once('.')
        .map(|(base, _)| base)
        .unwrap_or(filename);
    let slug = stem
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    let base = format!("{prefix}-{}", if slug.is_empty() { "local" } else { &slug });
    if used_ids.insert(base.clone()) {
        return base;
    }
    for index in 2.. {
        let candidate = format!("{base}-{index}");
        if used_ids.insert(candidate.clone()) {
            return candidate;
        }
    }
    unreachable!()
}

fn load_pack_changelog(
    repo_dir: &std::path::Path,
    limit: usize,
    since_commit: Option<&str>,
) -> Result<Vec<PackChangelogEntry>, CommandError> {
    use git2::{Delta, Repository};

    let repo = Repository::open(repo_dir)?;
    let mut walk = repo.revwalk()?;
    walk.push_head()?;

    let mut entries = Vec::new();
    for oid in walk {
        let oid = oid?;
        if since_commit.is_some_and(|base| oid.to_string() == base) {
            break;
        }
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;
        let parent = commit.parents().next();
        let parent_tree = parent.as_ref().map(|p| p.tree()).transpose()?;
        let current_manifest = manifest_from_tree(&repo, &tree)?;
        let previous_manifest = match parent_tree.as_ref() {
            Some(parent_tree) => manifest_from_tree(&repo, parent_tree)?,
            None => None,
        };

        let mut items = Vec::new();
        items.extend(diff_manifest_category(
            previous_manifest.as_ref().map(|manifest| manifest.mods.as_slice()).unwrap_or(&[]),
            current_manifest.as_ref().map(|manifest| manifest.mods.as_slice()).unwrap_or(&[]),
            PublishCategory::Mods,
        ));
        items.extend(diff_manifest_category(
            previous_manifest
                .as_ref()
                .map(|manifest| manifest.resourcepacks.as_slice())
                .unwrap_or(&[]),
            current_manifest
                .as_ref()
                .map(|manifest| manifest.resourcepacks.as_slice())
                .unwrap_or(&[]),
            PublishCategory::Resourcepacks,
        ));
        items.extend(diff_manifest_category(
            previous_manifest
                .as_ref()
                .map(|manifest| manifest.shaderpacks.as_slice())
                .unwrap_or(&[]),
            current_manifest
                .as_ref()
                .map(|manifest| manifest.shaderpacks.as_slice())
                .unwrap_or(&[]),
            PublishCategory::Shaderpacks,
        ));

        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;
        let mut details_map: BTreeMap<(u8, u8), Vec<String>> = BTreeMap::new();
        for delta in diff.deltas() {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|path| path.to_string_lossy().replace('\\', "/"));
            let Some(path) = path else {
                continue;
            };
            let Some(category) = changelog_tree_category(&path) else {
                continue;
            };
            let action = match delta.status() {
                Delta::Added => PublishAction::Add,
                Delta::Deleted => PublishAction::Remove,
                Delta::Modified | Delta::Renamed | Delta::Copied | Delta::Typechange => PublishAction::Update,
                _ => continue,
            };
            details_map
                .entry((action_rank(&action), category_rank(&category)))
                .or_default()
                .push(tree_change_detail(&delta, &path));
        }

        for ((action_rank_value, category_rank_value), details) in details_map {
            let action = action_from_rank(action_rank_value);
            let category = category_from_rank(category_rank_value);
            if matches!(category, PublishCategory::Mods | PublishCategory::Resourcepacks | PublishCategory::Shaderpacks) {
                continue;
            }
            items.push(PackChangelogItem {
                action,
                category,
                count: details.len(),
                details,
            });
        }

        items.sort_by_key(|item| (action_rank(&item.action), category_rank(&item.category)));
        entries.push(PackChangelogEntry {
            commit_sha: commit.id().to_string(),
            pack_version: current_manifest
                .as_ref()
                .map(|manifest| manifest.pack.version.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            title: commit.summary().unwrap_or("Update").to_string(),
            description: commit.body().unwrap_or("").trim().to_string(),
            committed_at: commit.time().seconds(),
            items,
        });

        if entries.len() >= limit {
            break;
        }
    }

    Ok(entries)
}

fn manifest_from_tree(
    repo: &git2::Repository,
    tree: &git2::Tree<'_>,
) -> Result<Option<manifest::Manifest>, CommandError> {
    let Ok(entry) = tree.get_path(std::path::Path::new("manifest.json")) else {
        return Ok(None);
    };
    let blob = repo.find_blob(entry.id())?;
    let manifest = serde_json::from_slice::<manifest::Manifest>(blob.content())
        .map_err(|error| CommandError::Manifest(error.to_string()))?;
    Ok(Some(manifest))
}

fn diff_manifest_category(
    previous: &[manifest::Entry],
    current: &[manifest::Entry],
    category: PublishCategory,
) -> Vec<PackChangelogItem> {
    let previous_map = previous
        .iter()
        .map(|entry| (manifest_entry_key(entry), entry))
        .collect::<BTreeMap<_, _>>();
    let current_map = current
        .iter()
        .map(|entry| (manifest_entry_key(entry), entry))
        .collect::<BTreeMap<_, _>>();
    let mut seen = HashSet::new();
    let mut add = 0usize;
    let mut update = 0usize;
    let mut remove = 0usize;
    let mut add_details = Vec::new();
    let mut update_details = Vec::new();
    let mut remove_details = Vec::new();

    for (key, entry) in &current_map {
        seen.insert(key.clone());
        match previous_map.get(key) {
            None => {
                add += 1;
                add_details.push(manifest_entry_label(entry));
            }
            Some(previous_entry)
                if previous_entry.sha1 != entry.sha1
                    || previous_entry.filename != entry.filename
                    || previous_entry.repo_path != entry.repo_path =>
            {
                update += 1;
                update_details.push(manifest_update_label(previous_entry, entry));
            }
            Some(_) => {}
        }
    }

    for key in previous_map.keys() {
        if !seen.contains(key) {
            remove += 1;
            if let Some(entry) = previous_map.get(key) {
                remove_details.push(manifest_entry_label(entry));
            }
        }
    }

    let mut items = Vec::new();
    if add > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Add,
            category: category.clone(),
            count: add,
            details: add_details,
        });
    }
    if update > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Update,
            category: category.clone(),
            count: update,
            details: update_details,
        });
    }
    if remove > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Remove,
            category,
            count: remove,
            details: remove_details,
        });
    }
    items
}

fn manifest_entry_key(entry: &manifest::Entry) -> String {
    if !entry.id.is_empty() {
        return entry.id.clone();
    }
    entry.filename.clone()
}

fn changelog_tree_category(path: &str) -> Option<PublishCategory> {
    if path == "options.txt" {
        return Some(PublishCategory::Root);
    }
    if path.starts_with("configs/") {
        return Some(PublishCategory::Config);
    }
    if path.starts_with("kubejs/") {
        return Some(PublishCategory::Kubejs);
    }
    None
}

fn tree_change_detail(delta: &git2::DiffDelta<'_>, path: &str) -> String {
    let old_path = delta.old_file().path().map(|value| value.to_string_lossy().replace('\\', "/"));
    let new_path = delta.new_file().path().map(|value| value.to_string_lossy().replace('\\', "/"));
    match (old_path, new_path) {
        (Some(old_path), Some(new_path)) if old_path != new_path => format!("{old_path} -> {new_path}"),
        _ => path.to_string(),
    }
}

fn manifest_entry_label(entry: &manifest::Entry) -> String {
    if !entry.id.is_empty() {
        return entry.id.clone();
    }
    entry
        .filename
        .trim_end_matches(".jar")
        .trim_end_matches(".zip")
        .to_string()
}

fn manifest_update_label(previous: &manifest::Entry, current: &manifest::Entry) -> String {
    let label = if !current.id.is_empty() {
        current.id.clone()
    } else if !previous.id.is_empty() {
        previous.id.clone()
    } else {
        current.filename.clone()
    };
    format!("{label}: {} -> {}", previous.filename, current.filename)
}

fn action_rank(action: &PublishAction) -> u8 {
    match action {
        PublishAction::Add => 0,
        PublishAction::Update => 1,
        PublishAction::Remove => 2,
        PublishAction::Unchanged => 3,
    }
}

fn category_rank(category: &PublishCategory) -> u8 {
    match category {
        PublishCategory::Mods => 0,
        PublishCategory::Resourcepacks => 1,
        PublishCategory::Shaderpacks => 2,
        PublishCategory::Config => 3,
        PublishCategory::Kubejs => 4,
        PublishCategory::Root => 5,
    }
}

fn action_from_rank(rank: u8) -> PublishAction {
    match rank {
        0 => PublishAction::Add,
        1 => PublishAction::Update,
        2 => PublishAction::Remove,
        _ => PublishAction::Unchanged,
    }
}

fn category_from_rank(rank: u8) -> PublishCategory {
    match rank {
        0 => PublishCategory::Mods,
        1 => PublishCategory::Resourcepacks,
        2 => PublishCategory::Shaderpacks,
        3 => PublishCategory::Config,
        4 => PublishCategory::Kubejs,
        _ => PublishCategory::Root,
    }
}

fn next_publish_version(current_version: &str) -> String {
    use chrono::{Datelike, FixedOffset, Utc};

    let tz = FixedOffset::east_opt(8 * 60 * 60).expect("valid GMT+8 offset");
    let now = Utc::now().with_timezone(&tz);
    let date_prefix = format!("v{:04}.{:02}.{:02}", now.year(), now.month(), now.day());

    if let Some(suffix) = current_version.strip_prefix(&date_prefix) {
        if suffix.len() == 1 {
            let ch = suffix.as_bytes()[0];
            if (b'a'..=b'y').contains(&ch) {
                return format!("{date_prefix}{}", char::from(ch + 1));
            }
            if ch == b'z' {
                return format!("{date_prefix}z");
            }
        }
    }

    format!("{date_prefix}a")
}

fn read_unpublished_modrinth_state(
    mods_dir: &std::path::Path,
) -> Result<Vec<UnpublishedModrinthState>, CommandError> {
    let path = mods_dir.join(".modsync-unpublished-modrinth.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = std::fs::read(path)?;
    serde_json::from_slice(&bytes).map_err(|error| CommandError::Other(error.to_string()))
}

fn write_unpublished_modrinth_state(
    mods_dir: &std::path::Path,
    state: &[UnpublishedModrinthState],
) -> Result<(), CommandError> {
    let path = mods_dir.join(".modsync-unpublished-modrinth.json");
    let bytes = serde_json::to_vec_pretty(state).map_err(anyhow::Error::from)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

fn copy_local_file(src: &std::path::Path, dst: &std::path::Path) -> Result<(), CommandError> {
    if dst.exists() {
        std::fs::remove_file(dst)?;
    }
    if std::fs::hard_link(src, dst).is_ok() {
        return Ok(());
    }
    std::fs::copy(src, dst)?;
    Ok(())
}

async fn resolve_modrinth_preview(
    manifest: &manifest::Manifest,
    identifier: &str,
) -> Result<ModrinthAddPreview, CommandError> {
    let project_id = normalize_modrinth_identifier(identifier)?;
    let project = fetch_modrinth_project(&project_id).await?;
    let version = fetch_latest_modrinth_version(&project.id, &manifest.pack.mc_version, manifest.pack.loader).await?;
    build_modrinth_preview(manifest, project, version)
}

async fn resolve_modrinth_preview_from_ids(
    manifest: &manifest::Manifest,
    project_id: &str,
    version_id: &str,
) -> Result<ModrinthAddPreview, CommandError> {
    let project = fetch_modrinth_project(project_id).await?;
    let version = fetch_modrinth_version(version_id).await?;
    build_modrinth_preview(manifest, project, version)
}

fn build_modrinth_preview(
    manifest: &manifest::Manifest,
    project: ModrinthProjectApi,
    version: ModrinthVersionApi,
) -> Result<ModrinthAddPreview, CommandError> {
    let file = version
        .files
        .iter()
        .find(|file| file.primary)
        .cloned()
        .or_else(|| version.files.first().cloned())
        .ok_or_else(|| CommandError::Other("Modrinth version has no downloadable files".to_string()))?;
    let suggested_side = suggested_manifest_side(&project.client_side, &project.server_side);
    let already_tracked = manifest.mods.iter().any(|entry| {
        entry.project_id.as_deref() == Some(project.id.as_str())
            || entry.id == project.slug
            || entry.filename == file.filename
    });

    Ok(ModrinthAddPreview {
        project_id: project.id,
        version_id: version.id,
        slug: project.slug,
        title: project.title,
        description: project.description.unwrap_or_default(),
        icon_url: project.icon_url,
        version_number: version.version_number,
        filename: file.filename,
        size: file.size,
        url: file.url,
        sha1: file.hashes.sha1,
        sha512: file.hashes.sha512,
        suggested_side,
        already_tracked,
    })
}

async fn fetch_modrinth_project(project_id: &str) -> Result<ModrinthProjectApi, CommandError> {
    reqwest::Client::new()
        .get(format!("https://api.modrinth.com/v2/project/{project_id}"))
        .header(reqwest::header::USER_AGENT, "modsync/0.1 (https://github.com/gisketch/modsync)")
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<ModrinthProjectApi>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))
}

async fn fetch_latest_modrinth_version(
    project_id: &str,
    mc_version: &str,
    loader: manifest::Loader,
) -> Result<ModrinthVersionApi, CommandError> {
    let versions = reqwest::Client::new()
        .get(format!("https://api.modrinth.com/v2/project/{project_id}/version"))
        .header(reqwest::header::USER_AGENT, "modsync/0.1 (https://github.com/gisketch/modsync)")
        .query(&[
            ("game_versions", format!("[\"{mc_version}\"]")),
            ("loaders", format!("[\"{}\"]", modrinth_loader(loader))),
        ])
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<Vec<ModrinthVersionApi>>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?;
    versions
        .into_iter()
        .next()
        .ok_or_else(|| CommandError::Other("No compatible Modrinth version found for this pack".to_string()))
}

async fn fetch_modrinth_version(version_id: &str) -> Result<ModrinthVersionApi, CommandError> {
    reqwest::Client::new()
        .get(format!("https://api.modrinth.com/v2/version/{version_id}"))
        .header(reqwest::header::USER_AGENT, "modsync/0.1 (https://github.com/gisketch/modsync)")
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<ModrinthVersionApi>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))
}

fn normalize_modrinth_identifier(input: &str) -> Result<String, CommandError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(CommandError::Other("Enter Modrinth link, slug, or project id".to_string()));
    }
    if !trimmed.contains("://") {
        return Ok(trimmed.trim_matches('/').to_string());
    }
    let url = url::Url::parse(trimmed).map_err(|error| CommandError::Other(error.to_string()))?;
    if url.host_str() != Some("modrinth.com") && url.host_str() != Some("www.modrinth.com") {
        return Err(CommandError::Other("Only Modrinth links supported for this flow".to_string()));
    }
    let segments = url
        .path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect::<Vec<_>>())
        .unwrap_or_default();
    if segments.len() < 2 {
        return Err(CommandError::Other("Could not parse Modrinth project from link".to_string()));
    }
    Ok(segments[1].to_string())
}

fn modrinth_loader(loader: manifest::Loader) -> &'static str {
    match loader {
        manifest::Loader::NeoForge => "neoforge",
        manifest::Loader::Fabric => "fabric",
        manifest::Loader::Forge => "forge",
        manifest::Loader::Quilt => "quilt",
    }
}

fn suggested_manifest_side(client_side: &str, server_side: &str) -> manifest::Side {
    let client_supported = client_side != "unsupported";
    let server_supported = server_side != "unsupported";
    match (client_supported, server_supported) {
        (true, true) => manifest::Side::Both,
        (true, false) => manifest::Side::Client,
        (false, true) => manifest::Side::Server,
        (false, false) => manifest::Side::Client,
    }
}

fn parse_manifest_side(value: &str) -> Result<manifest::Side, CommandError> {
    match value {
        "client" => Ok(manifest::Side::Client),
        "server" => Ok(manifest::Side::Server),
        "both" => Ok(manifest::Side::Both),
        _ => Err(CommandError::Other(format!("Unsupported side: {value}"))),
    }
}

