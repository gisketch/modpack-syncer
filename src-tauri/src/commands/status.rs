use serde::Serialize;

use super::CommandError;
use crate::{git, manifest, paths, prism};

#[derive(Debug, Serialize)]
pub struct ModStatus {
    pub id: Option<String>,
    pub filename: String,
    pub size: Option<u64>,
    pub status: &'static str,
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
    let manifest = tokio::task::spawn_blocking({
        let path = manifest_path.clone();
        move || manifest::load_from_path(&path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;
    let previous_manifest = tokio::task::spawn_blocking({
        let pack_dir = pack_dir.clone();
        move || -> Result<Option<manifest::Manifest>, CommandError> {
            let Some(bytes) = git::read_head_file(&pack_dir, "manifest.json")? else {
                return Ok(None);
            };
            let parsed = serde_json::from_slice::<manifest::Manifest>(&bytes).ok();
            Ok(parsed)
        }
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let mods_dir_opt = prism::instance_mods_dir(&instance_name);

    tokio::task::spawn_blocking(move || {
        let manifest_filenames = manifest
            .mods
            .iter()
            .map(|entry| enabled_artifact_filename(&entry.filename).to_string())
            .collect::<HashSet<_>>();
        let mut out = Vec::with_capacity(manifest.mods.len());
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
        let updated_old_filenames = manifest
            .mods
            .iter()
            .filter_map(|entry| {
                previous_manifest_by_id
                    .get(entry.id.as_str())
                    .filter(|prev| prev.filename != entry.filename)
                    .map(|prev| enabled_artifact_filename(&prev.filename).to_string())
            })
            .collect::<HashSet<_>>();
        let removed_from_manifest = previous_manifest
            .as_ref()
            .map(|manifest| {
                manifest
                    .mods
                    .iter()
                    .filter(|entry| {
                        !manifest_filenames.contains(enabled_artifact_filename(&entry.filename))
                    })
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let removed_filenames = removed_from_manifest
            .iter()
            .map(|entry| enabled_artifact_filename(&entry.filename).to_string())
            .collect::<HashSet<_>>();

        for entry in &manifest.mods {
            let filename = enabled_artifact_filename(&entry.filename);
            let status = match &mods_dir_opt {
                None => "missing",
                Some(dir) => {
                    let path = dir.join(filename);
                    let disabled_path = dir.join(format!("{filename}.disabled"));
                    if path.exists() {
                        match std::fs::read(&path) {
                            Ok(bytes) => {
                                let got = hex::encode(Sha1::digest(&bytes));
                                if got.eq_ignore_ascii_case(&entry.sha1) {
                                    "synced"
                                } else {
                                    "outdated"
                                }
                            }
                            Err(_) => "missing",
                        }
                    } else if disabled_path.exists()
                        && (entry.optional || is_disabled_artifact_filename(&entry.filename))
                    {
                        "disabled"
                    } else if let Some(previous) = previous_by_id.get(entry.id.as_str()) {
                        if dir
                            .join(enabled_artifact_filename(&previous.filename))
                            .exists()
                        {
                            "outdated"
                        } else {
                            "missing"
                        }
                    } else if let Some(previous) = previous_manifest_by_id.get(entry.id.as_str()) {
                        let previous_filename = enabled_artifact_filename(&previous.filename);
                        if previous_filename != filename && dir.join(previous_filename).exists() {
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
                id: Some(entry.id.clone()),
                filename: filename.to_string(),
                size: Some(entry.size as u64),
                status,
            });
        }

        for entry in removed_from_manifest {
            out.push(ModStatus {
                id: Some(entry.id),
                filename: entry.filename,
                size: Some(entry.size as u64),
                status: "deleted",
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
                    || filename.ends_with(".disabled")
                    || updated_old_filenames.contains(&filename)
                    || removed_filenames.contains(&filename)
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

fn enabled_artifact_filename(filename: &str) -> &str {
    filename.strip_suffix(".disabled").unwrap_or(filename)
}

fn is_disabled_artifact_filename(filename: &str) -> bool {
    filename.ends_with(".disabled")
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
