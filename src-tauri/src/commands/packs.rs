use super::CommandError;
use crate::{download, git, manifest, paths, prism};
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Serialize)]
pub struct PackSummary {
    pub id: String,
    pub url: String,
    pub path: String,
    pub head_sha: String,
    pub is_local: bool,
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
        is_local: false,
    })
}

#[tauri::command]
pub async fn create_local_pack(
    name: String,
    mc_version: String,
    loader: manifest::Loader,
    loader_version: String,
) -> Result<PackSummary, CommandError> {
    let name = required_value(name, "Pack name")?;
    let mc_version = required_value(mc_version, "Minecraft version")?;
    let loader_version = required_value(loader_version, "Loader version")?;
    let root = paths::packs_dir()?;
    let id = unique_pack_id(&root, &paths::pack_id_from_name(&name));
    let dest = root.join(&id);
    let manifest = starter_manifest(name, mc_version, loader, loader_version);
    let dest_clone = dest.clone();
    let head = tokio::task::spawn_blocking(move || -> Result<String, CommandError> {
        std::fs::create_dir_all(&dest_clone)?;
        let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(anyhow::Error::from)?;
        std::fs::write(dest_clone.join("manifest.json"), manifest_bytes)?;
        std::fs::write(
            dest_clone.join("README.md"),
            "# Local modsync pack\n\nCreated locally by modsync. Add a remote later when ready to publish.\n",
        )?;
        prism::write_default_launch_presets(&dest_clone)?;
        Ok(git::init_local_repo(&dest_clone, "Initial local pack")?)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    Ok(PackSummary {
        id,
        url: String::new(),
        path: dest.display().to_string(),
        head_sha: head,
        is_local: true,
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
        let url = git::origin_url(&path).ok().flatten().unwrap_or_default();
        out.push(PackSummary {
            id,
            is_local: url.is_empty(),
            url,
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
        is_local: !git::has_origin(&dest).unwrap_or(false),
        url: git::origin_url(&dest).ok().flatten().unwrap_or_default(),
        path: dest.display().to_string(),
        head_sha: head,
    })
}

#[tauri::command]
pub async fn refresh_pack_for_action(
    app: tauri::AppHandle,
    pack_id: String,
) -> Result<PackSummary, CommandError> {
    let dest = paths::packs_dir()?.join(&pack_id);
    let dest_clone = dest.clone();
    let pack_id_clone = pack_id.clone();
    let head = tokio::task::spawn_blocking(move || {
        git::update_if_changed_with_progress(&dest_clone, |progress| {
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
        is_local: !git::has_origin(&dest).unwrap_or(false),
        url: git::origin_url(&dest).ok().flatten().unwrap_or_default(),
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

fn required_value(value: String, label: &str) -> Result<String, CommandError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        Err(CommandError::Other(format!("{label} is required")))
    } else {
        Ok(value)
    }
}

fn unique_pack_id(root: &std::path::Path, base: &str) -> String {
    if !root.join(base).exists() {
        return base.to_string();
    }
    for n in 2.. {
        let candidate = format!("{base}-{n}");
        if !root.join(&candidate).exists() {
            return candidate;
        }
    }
    unreachable!("unbounded pack id suffix loop")
}

fn starter_manifest(
    name: String,
    mc_version: String,
    loader: manifest::Loader,
    loader_version: String,
) -> manifest::Manifest {
    manifest::Manifest {
        schema_version: manifest::CURRENT_SCHEMA_VERSION,
        pack: manifest::PackMeta {
            name,
            icon: None,
            version: "0.1.0".to_string(),
            mc_version,
            loader,
            loader_version,
        },
        mods: Vec::new(),
        resourcepacks: Vec::new(),
        shaderpacks: Vec::new(),
    }
}
