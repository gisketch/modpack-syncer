use serde::Serialize;
use tauri::Emitter;

use super::option_presets::resolve_option_preset_selection;
use super::sync_review::{
    apply_options_sync, apply_shader_settings_sync, build_options_sync_preview,
    build_shader_settings_preview, set_options_ignored, OptionsSyncCategory, OptionsSyncPreview,
    ShaderSettingsPreview,
};
use super::CommandError;
use crate::{cache, download, manifest, paths, prism};

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
    sync_shader_settings: Option<bool>,
    option_preset_id: Option<String>,
    option_sync_categories: Option<Vec<OptionsSyncCategory>>,
) -> Result<SyncInstanceReport, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let manifest_path = manifest_path.clone();
        move || manifest::load_from_path(&manifest_path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let sync_shaderpacks = manifest
        .shaderpacks
        .iter()
        .filter(|entry| !is_shaderpack_sidecar(&entry.filename))
        .cloned()
        .collect::<Vec<_>>();

    let remote_mods = manifest
        .mods
        .iter()
        .chain(manifest.resourcepacks.iter())
        .chain(sync_shaderpacks.iter())
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
                completed: fetch_report.cached
                    + fetch_report.downloaded
                    + fetch_report.failures.len(),
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

    let resolved_mods = resolve_entries(&pack_dir, &manifest.mods)?;
    let resolved_resourcepacks = resolve_entries(&pack_dir, &manifest.resourcepacks)?;
    let resolved_shaderpacks = resolve_entries(&pack_dir, &sync_shaderpacks)?;
    let launch_profile = prism::load_launch_profile(&pack_id)?;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
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
    let manifest_clone = manifest.clone();
    let instance_name_clone = instance_name.clone();
    let apply_shader_settings = sync_shader_settings.unwrap_or(false);
    let enabled_option_categories =
        option_sync_categories.unwrap_or_else(default_options_sync_categories);
    let option_preset_selection =
        resolve_option_preset_selection(&pack_dir, option_preset_id.as_deref())?;
    let inst_report = tokio::task::spawn_blocking(move || {
        let report = prism::write_instance(
            &instance_name_clone,
            &manifest_clone,
            &resolved_mods,
            &resolved_resourcepacks,
            &resolved_shaderpacks,
            &pack_dir_clone,
            Some(&launch_profile),
        )?;
        apply_options_sync(
            &pack_dir_clone.join("options.txt"),
            &instance_name_clone,
            &option_preset_selection,
            &enabled_option_categories,
        )?;
        if apply_shader_settings {
            apply_shader_settings_sync(
                &pack_dir_clone,
                &instance_name_clone,
                &option_preset_selection,
            )?;
        }
        Ok::<_, CommandError>(report)
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

fn default_options_sync_categories() -> Vec<OptionsSyncCategory> {
    vec![
        OptionsSyncCategory::Keybinds,
        OptionsSyncCategory::Video,
        OptionsSyncCategory::Other,
    ]
}

#[tauri::command]
pub async fn preview_options_sync(
    pack_id: String,
    instance_name: Option<String>,
    option_preset_id: Option<String>,
) -> Result<OptionsSyncPreview, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let selection = resolve_option_preset_selection(&pack_dir, option_preset_id.as_deref())?;
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_root = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;

    tokio::task::spawn_blocking(move || {
        build_options_sync_preview(
            &pack_dir.join("options.txt"),
            &instance_root.join("options.txt"),
            &selection,
        )
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn set_options_sync_ignored(
    pack_id: String,
    key: String,
    ignored: bool,
    instance_name: Option<String>,
) -> Result<Vec<String>, CommandError> {
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_root = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;

    tokio::task::spawn_blocking(move || set_options_ignored(&instance_root, key, ignored))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn preview_shader_settings_sync(
    pack_id: String,
    instance_name: Option<String>,
    option_preset_id: Option<String>,
) -> Result<ShaderSettingsPreview, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let selection = resolve_option_preset_selection(&pack_dir, option_preset_id.as_deref())?;
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_root = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;

    tokio::task::spawn_blocking(move || {
        build_shader_settings_preview(&pack_dir, &instance_root, &selection)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

fn is_shaderpack_sidecar(filename: &str) -> bool {
    filename.ends_with(".txt")
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
