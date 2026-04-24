//! Tauri commands exposed to the frontend.
//! Keep this in sync with `src/lib/tauri.ts`.

use serde::Serialize;
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

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishAuthSettings {
    pub method: Option<String>,
    pub has_pat: bool,
}

impl From<git::GitError> for CommandError {
    fn from(e: git::GitError) -> Self {
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

    let commit_sha = tokio::task::spawn_blocking(move || git::commit_and_push(&pack_dir, &message, auth))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;

    Ok(PublishPushReport { commit_sha, method })
}

#[tauri::command]
pub async fn apply_instance_publish(
    pack_id: String,
    instance_name: Option<String>,
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

    tokio::task::spawn_blocking(move || -> Result<PublishApplyReport, CommandError> {
        let mut manifest = manifest;
        let mut repo_files_written = 0usize;
        let mut repo_files_removed = 0usize;

        apply_artifact_dir(
            &instance_dir.join("mods"),
            &pack_dir.join("mods"),
            "mods",
            &mut manifest.mods,
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_artifact_dir(
            &instance_dir.join("resourcepacks"),
            &pack_dir.join("resourcepacks"),
            "resourcepacks",
            &mut manifest.resourcepacks,
            &mut repo_files_written,
            &mut repo_files_removed,
        )?;
        apply_artifact_dir(
            &instance_dir.join("shaderpacks"),
            &pack_dir.join("shaderpacks"),
            "shaderpacks",
            &mut manifest.shaderpacks,
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
    pub status: &'static str, // "synced" | "outdated" | "missing" | "deleted"
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
        let manifest_ids = m
            .mods
            .iter()
            .map(|entry| entry.id.clone())
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
            if !previous_state.is_empty() {
                for previous in &previous_state {
                    if manifest_ids.contains(&previous.id) || manifest_filenames.contains(&previous.filename) {
                        continue;
                    }

                    let path = dir.join(&previous.filename);
                    if !path.exists() {
                        continue;
                    }

                    out.push(ModStatus {
                        id: None,
                        filename: previous.filename.clone(),
                        size: Some(previous.size),
                        status: "deleted",
                    });
                }
            } else {
                let sidecar = dir.join(".modsync-managed.txt");
                if let Ok(previous) = std::fs::read_to_string(sidecar) {
                    for filename in previous.lines().map(str::trim).filter(|line| !line.is_empty()) {
                        if manifest_filenames.contains(filename) || updated_old_filenames.contains(filename) {
                            continue;
                        }

                        let path = dir.join(filename);
                        if !path.exists() {
                            continue;
                        }

                        out.push(ModStatus {
                            id: None,
                            filename: filename.to_string(),
                            size: path.metadata().ok().map(|meta| meta.len()),
                            status: "deleted",
                        });
                    }
                }
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

fn apply_artifact_dir(
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
    repo_prefix: &str,
    entries: &mut Vec<manifest::Entry>,
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
        let needs_repo_copy = match &existing {
            Some(entry) if entry.sha1.eq_ignore_ascii_case(&sha1) && entry.source != manifest::Source::Repo => false,
            _ => true,
        };
        let mut entry = existing.unwrap_or_else(|| manifest::Entry {
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
        });

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
