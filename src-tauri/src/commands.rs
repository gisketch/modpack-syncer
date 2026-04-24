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
    let report = download::fetch_all(m.mods).await;
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

    let fetch_report = download::fetch_all_with_progress(m.mods.clone(), {
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

    let cached: Vec<(std::path::PathBuf, String)> = m
        .mods
        .iter()
        .map(|e| Ok((cache::path_for(&e.sha1)?, e.filename.clone())))
        .collect::<anyhow::Result<Vec<_>>>()?;

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
        prism::write_instance(&inst_name_clone, &manifest_clone, &cached, &pack_dir_clone)
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

#[tauri::command]
pub async fn launch_instance(instance_name: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || prism::launch(&instance_name))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(())
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
