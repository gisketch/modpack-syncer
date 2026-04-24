//! Tauri commands exposed to the frontend.
//! Keep this in sync with `src/lib/tauri.ts`.

use serde::Serialize;

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

#[tauri::command]
pub async fn sync_instance(
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

    let fetch_report = download::fetch_all(m.mods.clone()).await;
    if !fetch_report.failures.is_empty() {
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
    let pack_dir_clone = pack_dir.clone();
    let manifest_clone = m.clone();
    let inst_name_clone = inst_name.clone();
    let inst_report = tokio::task::spawn_blocking(move || {
        prism::write_instance(&inst_name_clone, &manifest_clone, &cached, &pack_dir_clone)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

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
