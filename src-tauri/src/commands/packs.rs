use super::CommandError;
use crate::{download, git, manifest, paths};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PackSummary {
    pub id: String,
    pub url: String,
    pub path: String,
    pub head_sha: String,
}

#[tauri::command]
pub async fn add_pack(url: String) -> Result<PackSummary, CommandError> {
    let id = paths::pack_id_from_url(&url);
    let dest = paths::packs_dir()?.join(&id);
    let url_clone = url.clone();
    let dest_clone = dest.clone();
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
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(manifest)
}

#[tauri::command]
pub async fn fetch_mods(pack_id: String) -> Result<download::FetchReport, CommandError> {
    let path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    let report = download::fetch_all(
        manifest
            .mods
            .into_iter()
            .filter(|entry| entry.source != manifest::Source::Repo)
            .collect(),
    )
    .await;
    Ok(report)
}
