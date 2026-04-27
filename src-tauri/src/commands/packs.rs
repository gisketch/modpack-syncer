use super::CommandError;
use crate::{download, git, manifest, paths};
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Serialize)]
pub struct PackSummary {
    pub id: String,
    pub url: String,
    pub path: String,
    pub head_sha: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackTransferProgressEvent {
    pub pack_id: String,
    pub stage: String,
    pub received_objects: usize,
    pub total_objects: usize,
    pub indexed_objects: usize,
    pub received_bytes: usize,
}

#[tauri::command]
pub async fn add_pack(app: tauri::AppHandle, url: String) -> Result<PackSummary, CommandError> {
    let id = paths::pack_id_from_url(&url);
    let dest = paths::packs_dir()?.join(&id);
    let url_clone = url.clone();
    let dest_clone = dest.clone();
    let id_clone = id.clone();
    let head = tokio::task::spawn_blocking(move || {
        git::clone_or_update_with_progress(&url_clone, &dest_clone, |progress| {
            let _ = app.emit(
                "pack-transfer-progress",
                PackTransferProgressEvent {
                    pack_id: id_clone.clone(),
                    stage: progress.stage.to_string(),
                    received_objects: progress.received_objects,
                    total_objects: progress.total_objects,
                    indexed_objects: progress.indexed_objects,
                    received_bytes: progress.received_bytes,
                },
            );
        })
    })
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
pub async fn update_pack(
    app: tauri::AppHandle,
    pack_id: String,
) -> Result<PackSummary, CommandError> {
    let dest = paths::packs_dir()?.join(&pack_id);
    let dest_clone = dest.clone();
    let pack_id_clone = pack_id.clone();
    let head = tokio::task::spawn_blocking(move || {
        git::update_with_progress(&dest_clone, |progress| {
            let _ = app.emit(
                "pack-transfer-progress",
                PackTransferProgressEvent {
                    pack_id: pack_id_clone.clone(),
                    stage: progress.stage.to_string(),
                    received_objects: progress.received_objects,
                    total_objects: progress.total_objects,
                    indexed_objects: progress.indexed_objects,
                    received_bytes: progress.received_bytes,
                },
            );
        })
    })
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
