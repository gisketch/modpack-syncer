use super::{
    modrinth, CommandError, PublishAction, PublishApplyReport, PublishAuthSettings,
    PublishCategory, PublishPushReport, PublishScanItem, PublishScanReport,
};
use crate::{cache, git, manifest, paths, prism};
use serde::Serialize;
use tauri::Emitter;

const PUBLISH_PUSH_TIMEOUT_SECONDS: u64 = 300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishPushProgressEvent {
    pack_id: String,
    stage: String,
    current_path: Option<String>,
    completed: usize,
    total: usize,
    bytes: Option<usize>,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishScanProgressEvent {
    pack_id: String,
    stage: String,
    current_path: Option<String>,
    completed: usize,
    total: usize,
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
pub async fn scan_instance_publish(
    app: tauri::AppHandle,
    pack_id: String,
    instance_name: Option<String>,
    ignore_patterns: Option<Vec<String>>,
) -> Result<PublishScanReport, CommandError> {
    use std::collections::HashSet;
    let _ignore_patterns = ignore_patterns.unwrap_or_default();

    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let path = manifest_path.clone();
        move || manifest::load_from_path(&path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_dir = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let instance_dir_for_scan = instance_dir.clone();

    tokio::task::spawn_blocking(move || -> Result<PublishScanReport, CommandError> {
        let scan_total = 8usize;
        let emit_scan = |stage: &str, completed: usize| {
            let _ = app.emit(
                "publish-scan-progress",
                PublishScanProgressEvent {
                    pack_id: pack_id.clone(),
                    stage: stage.to_string(),
                    current_path: None,
                    completed,
                    total: scan_total,
                },
            );
        };
        let mut items = Vec::new();
        emit_scan("mods", 0);
        items.extend(scan_artifact_dir(
            PublishCategory::Mods,
            &instance_dir_for_scan.join("mods"),
            &manifest.mods,
        )?);
        emit_scan("resourcepacks", 1);
        items.extend(scan_artifact_dir(
            PublishCategory::Resourcepacks,
            &instance_dir_for_scan.join("resourcepacks"),
            &manifest.resourcepacks,
        )?);
        emit_scan("shaderpacks", 2);
        items.extend(scan_artifact_dir(
            PublishCategory::Shaderpacks,
            &instance_dir_for_scan.join("shaderpacks"),
            &manifest.shaderpacks,
        )?);
        emit_scan("config", 3);
        items.extend(scan_tree_dir(
            PublishCategory::Config,
            &instance_dir_for_scan.join("config"),
            &pack_dir.join("configs"),
        )?);
        emit_scan("shader-settings", 4);
        items.extend(scan_shader_settings_publish(
            &instance_dir_for_scan,
            &pack_dir,
        )?);
        emit_scan("presets", 5);
        items.extend(scan_repo_status_dir(
            PublishCategory::OptionPresets,
            &pack_dir,
            "presets",
        )?);
        emit_scan("kubejs", 6);
        items.extend(scan_tree_dir(
            PublishCategory::Kubejs,
            &instance_dir_for_scan.join("kubejs"),
            &pack_dir.join("kubejs"),
        )?);
        emit_scan("options", 7);
        items.extend(scan_root_files(
            &instance_dir_for_scan,
            &pack_dir,
            &["options.txt"],
        )?);
        emit_scan("done", 8);

        let mut seen = HashSet::new();
        items.retain(|item| {
            seen.insert((item.relative_path.clone(), format!("{:?}", item.category)))
        });

        let report = PublishScanReport {
            instance_dir: instance_dir_for_scan.display().to_string(),
            items,
        };
        Ok(report)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn commit_and_push_publish(
    app: tauri::AppHandle,
    pack_id: String,
    message: String,
    ignore_patterns: Option<Vec<String>>,
    amend_previous: Option<bool>,
) -> Result<PublishPushReport, CommandError> {
    eprintln!("[modsync] publish push command: start for {pack_id}");
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let timeout_seconds = PUBLISH_PUSH_TIMEOUT_SECONDS;
    let amend = amend_previous.unwrap_or(false);
    let ignore_patterns = ignore_patterns.unwrap_or_default();
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
            let token = crate::keychain::load_github_pat()?.ok_or_else(|| {
                CommandError::Other("PAT mode selected but no token stored".to_string())
            })?;
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
        std::time::Duration::from_secs(timeout_seconds),
        tokio::task::spawn_blocking({
            let app = app.clone();
            let pack_id = pack_id.clone();
            move || {
                let should_include =
                    move |path: &std::path::Path| !publish_path_ignored(&ignore_patterns, path);
                git::commit_and_push_with_filter_progress(
                    &pack_dir,
                    &message,
                    auth,
                    should_include,
                    amend,
                    move |progress| {
                        let _ = app.emit(
                            "publish-push-progress",
                            PublishPushProgressEvent {
                                pack_id: pack_id.clone(),
                                stage: progress.stage.to_string(),
                                current_path: progress.current_path,
                                completed: progress.completed,
                                total: progress.total,
                                bytes: progress.bytes,
                                message: progress.message,
                            },
                        );
                    },
                )
            }
        }),
    )
    .await
    .map_err(|_| {
        CommandError::Git(format!(
            "publish push timed out after {} minutes",
            timeout_seconds / 60
        ))
    })?
    .map_err(|e| CommandError::Other(e.to_string()))??;

    eprintln!("[modsync] publish push command: done {commit_sha}");
    Ok(PublishPushReport { commit_sha, method })
}

#[tauri::command]
pub async fn load_source_manifest(pack_id: String) -> Result<manifest::Manifest, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || read_source_manifest(&pack_dir))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn restore_manifest_from_source(
    pack_id: String,
) -> Result<manifest::Manifest, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || {
        let source = read_source_manifest(&pack_dir)?;
        write_manifest(&pack_dir.join("manifest.json"), &source)?;
        Ok(source)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn set_manifest_mod_optional(
    pack_id: String,
    filename: String,
    optional: bool,
) -> Result<manifest::Entry, CommandError> {
    set_manifest_artifact_optional(
        pack_id,
        super::ManifestArtifactCategory::Mods,
        filename,
        optional,
    )
    .await
}

#[tauri::command]
pub async fn set_manifest_artifact_optional(
    pack_id: String,
    category: super::ManifestArtifactCategory,
    filename: String,
    optional: bool,
) -> Result<manifest::Entry, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || {
        let manifest_path = pack_dir.join("manifest.json");
        let mut manifest = manifest::load_from_path(&manifest_path)?;
        let entry = manifest_entries_mut(&mut manifest, category)
            .iter_mut()
            .find(|entry| entry.filename == filename)
            .ok_or_else(|| {
                CommandError::Manifest(format!("manifest entry not found: {filename}"))
            })?;
        entry.optional = optional;
        let updated = entry.clone();
        write_manifest(&manifest_path, &manifest)?;
        Ok(updated)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn delete_manifest_artifact(
    pack_id: String,
    category: super::ManifestArtifactCategory,
    filename: String,
) -> Result<manifest::Entry, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || {
        let manifest_path = pack_dir.join("manifest.json");
        let mut manifest = manifest::load_from_path(&manifest_path)?;
        let entries = manifest_entries_mut(&mut manifest, category);
        let index = entries
            .iter()
            .position(|entry| entry.filename == filename)
            .ok_or_else(|| {
                CommandError::Manifest(format!("manifest entry not found: {filename}"))
            })?;
        let removed = entries.remove(index);
        write_manifest(&manifest_path, &manifest)?;
        Ok(removed)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn restore_manifest_artifact(
    pack_id: String,
    category: super::ManifestArtifactCategory,
    filename: String,
) -> Result<manifest::Entry, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || {
        let manifest_path = pack_dir.join("manifest.json");
        let mut manifest = manifest::load_from_path(&manifest_path)?;
        let source_manifest = read_source_manifest(&pack_dir)?;
        let source_entry = manifest_entries(&source_manifest, category)
            .iter()
            .find(|entry| entry.filename == filename)
            .cloned()
            .ok_or_else(|| CommandError::Manifest(format!("source entry not found: {filename}")))?;
        let entries = manifest_entries_mut(&mut manifest, category);
        if let Some(entry) = entries.iter_mut().find(|entry| entry.filename == filename) {
            *entry = source_entry.clone();
        } else {
            entries.push(source_entry.clone());
        }
        entries.sort_by(|left, right| left.filename.cmp(&right.filename));
        write_manifest(&manifest_path, &manifest)?;
        Ok(source_entry)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn apply_instance_publish(
    pack_id: String,
    instance_name: Option<String>,
    version: Option<String>,
    ignore_patterns: Option<Vec<String>>,
) -> Result<PublishApplyReport, CommandError> {
    let _ignore_patterns = ignore_patterns.unwrap_or_default();
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let path = manifest_path.clone();
        move || manifest::load_from_path(&path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_dir = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let unpublished_modrinth =
        modrinth::read_unpublished_modrinth_state(&instance_dir.join("mods"))?;

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
        apply_shader_settings_publish(
            &instance_dir,
            &pack_dir,
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
        if should_skip_artifact_publish(&category, &filename) {
            continue;
        }
        let size = path.metadata()?.len();
        let (action, source) = match baseline.get(&filename) {
            Some(entry)
                if entry.size == size || should_trust_artifact_filename_match(&category) =>
            {
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
            sha1: None,
            action,
            source,
        });
    }

    for entry in entries {
        if should_skip_artifact_publish(&category, &entry.filename) {
            continue;
        }
        if !seen.contains(&entry.filename) {
            out.push(PublishScanItem {
                category: category.clone(),
                relative_path: entry.filename.clone(),
                size: Some(entry.size),
                sha1: None,
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

    let instance = list_relative_regular_files(instance_dir)?
        .into_iter()
        .filter(|(rel, _)| !should_skip_tree_publish(&category, rel))
        .collect::<Vec<_>>();
    let repo = list_relative_regular_files(repo_dir)?
        .into_iter()
        .filter(|(rel, _)| !should_skip_tree_publish(&category, rel))
        .collect::<Vec<_>>();
    let repo_map = repo.into_iter().collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for (rel, path) in instance {
        let size = path.metadata()?.len();
        let action = match repo_map.get(&rel) {
            Some(repo_path) if repo_path.metadata()?.len() == size => PublishAction::Unchanged,
            Some(_) => PublishAction::Update,
            None => PublishAction::Add,
        };
        seen.insert(rel.clone());
        out.push(PublishScanItem {
            category: category.clone(),
            relative_path: rel,
            size: Some(size),
            sha1: None,
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
                sha1: None,
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
                let instance_size = instance_path.metadata()?.len();
                let repo_size = repo_path.metadata()?.len();
                out.push(PublishScanItem {
                    category: PublishCategory::Root,
                    relative_path: (*rel).to_string(),
                    size: Some(instance_size),
                    sha1: None,
                    action: if repo_size == instance_size {
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
                sha1: None,
                action: PublishAction::Add,
                source: Some("repo-tree".to_string()),
            }),
            (false, true) => out.push(PublishScanItem {
                category: PublishCategory::Root,
                relative_path: (*rel).to_string(),
                size: Some(repo_path.metadata()?.len()),
                sha1: None,
                action: PublishAction::Remove,
                source: Some("repo-tree".to_string()),
            }),
            (false, false) => {}
        }
    }
    Ok(out)
}

fn scan_repo_status_dir(
    category: PublishCategory,
    repo_root: &std::path::Path,
    prefix: &str,
) -> Result<Vec<PublishScanItem>, CommandError> {
    let repo = git2::Repository::open(repo_root)?;
    let mut options = git2::StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut options))?;
    let prefix_slash = format!("{prefix}/");
    let mut out = Vec::new();

    for status in statuses.iter() {
        let Some(path) = status.path() else {
            continue;
        };
        if !path.starts_with(&prefix_slash) {
            continue;
        }
        let relative_path = path.to_string();
        let full_path = repo_root.join(path);
        let action = publish_action_from_git_status(status.status());
        out.push(PublishScanItem {
            category: category.clone(),
            relative_path,
            size: full_path.metadata().ok().map(|metadata| metadata.len()),
            sha1: None,
            action,
            source: Some("repo-git".to_string()),
        });
    }

    out.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(out)
}

fn publish_action_from_git_status(status: git2::Status) -> PublishAction {
    if status.intersects(git2::Status::WT_DELETED | git2::Status::INDEX_DELETED) {
        PublishAction::Remove
    } else if status.intersects(git2::Status::WT_NEW | git2::Status::INDEX_NEW) {
        PublishAction::Add
    } else if status.intersects(
        git2::Status::WT_MODIFIED
            | git2::Status::INDEX_MODIFIED
            | git2::Status::WT_RENAMED
            | git2::Status::INDEX_RENAMED
            | git2::Status::WT_TYPECHANGE
            | git2::Status::INDEX_TYPECHANGE,
    ) {
        PublishAction::Update
    } else {
        PublishAction::Unchanged
    }
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
    unpublished_modrinth: Option<&[modrinth::UnpublishedModrinthState]>,
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
) -> Result<(), CommandError> {
    use std::collections::{HashMap, HashSet};

    let instance_files = list_regular_files(instance_dir)?
        .into_iter()
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| !should_skip_artifact_publish_prefix(repo_prefix, name))
        })
        .collect::<Vec<_>>();
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
        let preserve_existing_same_name =
            existing.is_some() && should_trust_artifact_filename_match_prefix(repo_prefix);
        let needs_repo_copy = if unpublished.is_some() || preserve_existing_same_name {
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

        if preserve_existing_same_name {
            seen_filenames.insert(filename);
            next_entries.push(entry);
            continue;
        }

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

    let instance_files = list_relative_regular_files(instance_dir)?
        .into_iter()
        .filter(|(rel, _)| !should_skip_tree_publish_prefix(repo_dir, rel))
        .collect::<Vec<_>>();
    let repo_files = list_relative_regular_files(repo_dir)?
        .into_iter()
        .filter(|(rel, _)| !should_skip_tree_publish_prefix(repo_dir, rel))
        .collect::<Vec<_>>();
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

fn should_skip_artifact_publish(category: &PublishCategory, filename: &str) -> bool {
    matches!(category, PublishCategory::Shaderpacks) && filename.ends_with(".txt")
}

fn should_trust_artifact_filename_match(category: &PublishCategory) -> bool {
    matches!(category, PublishCategory::Shaderpacks)
}

fn should_skip_artifact_publish_prefix(repo_prefix: &str, filename: &str) -> bool {
    repo_prefix == "shaderpacks" && filename.ends_with(".txt")
}

fn should_trust_artifact_filename_match_prefix(repo_prefix: &str) -> bool {
    repo_prefix == "shaderpacks"
}

fn should_skip_tree_publish(category: &PublishCategory, relative_path: &str) -> bool {
    matches!(category, PublishCategory::Config) && relative_path == "iris.properties"
}

fn should_skip_tree_publish_prefix(repo_dir: &std::path::Path, relative_path: &str) -> bool {
    repo_dir
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name == "configs" && relative_path == "iris.properties")
}

fn publish_path_ignored(patterns: &[String], path: &std::path::Path) -> bool {
    let candidate = normalize_publish_path(&path.to_string_lossy());
    let basename = candidate.rsplit('/').next().unwrap_or(candidate.as_str());
    patterns.iter().any(|pattern| {
        let pattern = normalize_publish_path(pattern);
        if pattern.is_empty() || pattern.starts_with('#') {
            return false;
        }
        if pattern.ends_with('/') {
            let prefix = pattern.trim_end_matches('/');
            return candidate == prefix || candidate.starts_with(&format!("{prefix}/"));
        }
        if pattern.contains('*') || pattern.contains('?') {
            return wildcard_match(&pattern, &candidate) || wildcard_match(&pattern, basename);
        }
        if pattern.contains('/') {
            candidate == pattern
        } else {
            basename == pattern || candidate.ends_with(&format!("/{pattern}"))
        }
    })
}

fn normalize_publish_path(path: &str) -> String {
    let directory_pattern = path.trim().ends_with('/');
    let normalized = path
        .trim()
        .replace('\\', "/")
        .trim_start_matches('/')
        .split('/')
        .filter(|part| !part.is_empty() && *part != ".")
        .collect::<Vec<_>>()
        .join("/");
    if directory_pattern && !normalized.is_empty() {
        format!("{normalized}/")
    } else {
        normalized
    }
}

fn wildcard_match(pattern: &str, candidate: &str) -> bool {
    fn inner(pattern: &[u8], candidate: &[u8]) -> bool {
        if pattern.is_empty() {
            return candidate.is_empty();
        }
        match pattern[0] {
            b'*' => {
                inner(&pattern[1..], candidate)
                    || (!candidate.is_empty() && inner(pattern, &candidate[1..]))
            }
            b'?' => !candidate.is_empty() && inner(&pattern[1..], &candidate[1..]),
            value => {
                !candidate.is_empty()
                    && value == candidate[0]
                    && inner(&pattern[1..], &candidate[1..])
            }
        }
    }
    inner(pattern.as_bytes(), candidate.as_bytes())
}

fn read_source_manifest(pack_dir: &std::path::Path) -> Result<manifest::Manifest, CommandError> {
    let bytes = git::read_head_file(pack_dir, "manifest.json")?
        .ok_or_else(|| CommandError::Manifest("source manifest not found in HEAD".to_string()))?;
    let manifest: manifest::Manifest = serde_json::from_slice(&bytes)
        .map_err(|e| CommandError::Manifest(format!("invalid source manifest json: {e}")))?;
    if manifest.schema_version != manifest::CURRENT_SCHEMA_VERSION {
        return Err(CommandError::Manifest(format!(
            "unsupported source schemaVersion {}",
            manifest.schema_version
        )));
    }
    Ok(manifest)
}

fn write_manifest(
    path: &std::path::Path,
    manifest: &manifest::Manifest,
) -> Result<(), CommandError> {
    let bytes = serde_json::to_vec_pretty(manifest).map_err(anyhow::Error::from)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

fn manifest_entries(
    manifest: &manifest::Manifest,
    category: super::ManifestArtifactCategory,
) -> &Vec<manifest::Entry> {
    match category {
        super::ManifestArtifactCategory::Mods => &manifest.mods,
        super::ManifestArtifactCategory::Resourcepacks => &manifest.resourcepacks,
        super::ManifestArtifactCategory::Shaderpacks => &manifest.shaderpacks,
    }
}

fn manifest_entries_mut(
    manifest: &mut manifest::Manifest,
    category: super::ManifestArtifactCategory,
) -> &mut Vec<manifest::Entry> {
    match category {
        super::ManifestArtifactCategory::Mods => &mut manifest.mods,
        super::ManifestArtifactCategory::Resourcepacks => &mut manifest.resourcepacks,
        super::ManifestArtifactCategory::Shaderpacks => &mut manifest.shaderpacks,
    }
}

fn scan_shader_settings_publish(
    instance_root: &std::path::Path,
    repo_root: &std::path::Path,
) -> Result<Vec<PublishScanItem>, CommandError> {
    let mut items = scan_root_files_with_category(
        PublishCategory::ShaderSettings,
        &instance_root.join("config"),
        &repo_root.join("configs"),
        &["iris.properties"],
    )?;

    let instance_shader_dir = instance_root.join("shaderpacks");
    let repo_shader_dir = repo_root.join("shaderpacks");
    let mut shader_items = scan_tree_dir_filtered(
        PublishCategory::ShaderSettings,
        &instance_shader_dir,
        &repo_shader_dir,
        |rel| rel.ends_with(".txt"),
    )?;
    items.append(&mut shader_items);
    Ok(items)
}

fn apply_shader_settings_publish(
    instance_root: &std::path::Path,
    repo_root: &std::path::Path,
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
) -> Result<(), CommandError> {
    apply_root_files(
        &instance_root.join("config"),
        &repo_root.join("configs"),
        &["iris.properties"],
        repo_files_written,
        repo_files_removed,
    )?;
    apply_tree_dir_filtered(
        &instance_root.join("shaderpacks"),
        &repo_root.join("shaderpacks"),
        repo_files_written,
        repo_files_removed,
        |rel| rel.ends_with(".txt"),
    )
}

fn scan_root_files_with_category(
    category: PublishCategory,
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
                let instance_size = instance_path.metadata()?.len();
                let repo_size = repo_path.metadata()?.len();
                out.push(PublishScanItem {
                    category: category.clone(),
                    relative_path: (*rel).to_string(),
                    size: Some(instance_size),
                    sha1: None,
                    action: if repo_size == instance_size {
                        PublishAction::Unchanged
                    } else {
                        PublishAction::Update
                    },
                    source: Some("repo-tree".to_string()),
                });
            }
            (true, false) => out.push(PublishScanItem {
                category: category.clone(),
                relative_path: (*rel).to_string(),
                size: Some(instance_path.metadata()?.len()),
                sha1: None,
                action: PublishAction::Add,
                source: Some("repo-tree".to_string()),
            }),
            (false, true) => out.push(PublishScanItem {
                category: category.clone(),
                relative_path: (*rel).to_string(),
                size: Some(repo_path.metadata()?.len()),
                sha1: None,
                action: PublishAction::Remove,
                source: Some("repo-tree".to_string()),
            }),
            (false, false) => {}
        }
    }
    Ok(out)
}

fn scan_tree_dir_filtered<F>(
    category: PublishCategory,
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
    include: F,
) -> Result<Vec<PublishScanItem>, CommandError>
where
    F: Fn(&str) -> bool,
{
    use std::collections::{HashMap, HashSet};

    let instance = list_relative_regular_files(instance_dir)?
        .into_iter()
        .filter(|(rel, _)| include(rel))
        .collect::<Vec<_>>();
    let repo = list_relative_regular_files(repo_dir)?
        .into_iter()
        .filter(|(rel, _)| include(rel))
        .collect::<Vec<_>>();
    let repo_map = repo.into_iter().collect::<HashMap<_, _>>();
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for (rel, path) in instance {
        let size = path.metadata()?.len();
        let action = match repo_map.get(&rel) {
            Some(repo_path) if repo_path.metadata()?.len() == size => PublishAction::Unchanged,
            Some(_) => PublishAction::Update,
            None => PublishAction::Add,
        };
        seen.insert(rel.clone());
        out.push(PublishScanItem {
            category: category.clone(),
            relative_path: rel,
            size: Some(size),
            sha1: None,
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
                sha1: None,
                action: PublishAction::Remove,
                source: Some("repo-tree".to_string()),
            });
        }
    }

    Ok(out)
}

fn apply_tree_dir_filtered<F>(
    instance_dir: &std::path::Path,
    repo_dir: &std::path::Path,
    repo_files_written: &mut usize,
    repo_files_removed: &mut usize,
    include: F,
) -> Result<(), CommandError>
where
    F: Fn(&str) -> bool,
{
    use std::collections::{HashMap, HashSet};

    let instance_files = list_relative_regular_files(instance_dir)?
        .into_iter()
        .filter(|(rel, _)| include(rel))
        .collect::<Vec<_>>();
    let repo_files = list_relative_regular_files(repo_dir)?
        .into_iter()
        .filter(|(rel, _)| include(rel))
        .collect::<Vec<_>>();
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

fn copy_file_to_repo(src: &std::path::Path, dst: &std::path::Path) -> Result<(), CommandError> {
    if same_existing_file(src, dst) {
        return Ok(());
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    retry_windows_file_lock(
        &format!("copy {} -> {}", src.display(), dst.display()),
        || std::fs::copy(src, dst),
    )?;
    Ok(())
}

fn same_existing_file(left: &std::path::Path, right: &std::path::Path) -> bool {
    if !left.exists() || !right.exists() {
        return false;
    }
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn remove_path_if_exists(path: &std::path::Path) -> Result<bool, CommandError> {
    if !path.exists() {
        return Ok(false);
    }
    retry_windows_file_lock(&format!("remove {}", path.display()), || {
        std::fs::remove_file(path)
    })?;
    Ok(true)
}

fn retry_windows_file_lock<T, F>(label: &str, mut op: F) -> Result<T, CommandError>
where
    F: FnMut() -> std::io::Result<T>,
{
    const ATTEMPTS: usize = 20;
    for attempt in 0..ATTEMPTS {
        match op() {
            Ok(value) => return Ok(value),
            Err(error) if is_windows_lock_error(&error) && attempt + 1 < ATTEMPTS => {
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
            Err(error) => return Err(CommandError::Io(format!("{label}: {error}"))),
        }
    }
    Err(CommandError::Io(format!("{label}: file stayed locked")))
}

fn is_windows_lock_error(error: &std::io::Error) -> bool {
    matches!(error.raw_os_error(), Some(32 | 33))
}

fn unique_local_id(
    prefix: &str,
    filename: &str,
    used_ids: &mut std::collections::HashSet<String>,
) -> String {
    let stem = filename
        .rsplit_once('.')
        .map(|(base, _)| base)
        .unwrap_or(filename);
    let slug = stem
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
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
