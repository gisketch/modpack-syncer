use serde::Serialize;
use tauri::Emitter;

use super::option_presets::{
    apply_option_preset_overrides, resolve_option_preset_selection, OptionPresetSelection,
};
use super::sync_review::{apply_options_sync, apply_shader_settings_sync, OptionsSyncCategory};
use super::{CommandError, ManifestArtifactCategory};
use crate::{manifest, paths, prism};

pub type LaunchProfile = prism::LaunchProfile;
pub type LaunchPresetConfig = prism::LaunchPresetConfig;
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

#[tauri::command]
pub async fn get_prism_settings() -> Result<prism::PrismSettings, CommandError> {
    tokio::task::spawn_blocking(prism::get_settings)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_prism_settings(
    binary_path: Option<String>,
    data_dir: Option<String>,
    offline_username: Option<String>,
    offline_uuid: Option<String>,
) -> Result<prism::PrismSettings, CommandError> {
    let settings = prism::PrismSettings {
        binary_path: binary_path.and_then(normalize_optional_path),
        data_dir: data_dir.and_then(normalize_optional_path),
        offline_username: offline_username.and_then(normalize_optional_text),
        offline_uuid: offline_uuid
            .map(normalize_optional_uuid)
            .transpose()?
            .flatten(),
    };
    tokio::task::spawn_blocking(move || prism::save_settings(settings))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
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
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || prism::load_launch_profile(&pack_id, &pack_dir))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_launch_preset_config(pack_id: String) -> Result<LaunchPresetConfig, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || prism::load_launch_preset_config(&pack_dir))
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
pub async fn set_launch_profile(
    pack_id: String,
    profile: LaunchProfile,
) -> Result<LaunchProfile, CommandError> {
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
pub async fn install_managed_prism(
    app: tauri::AppHandle,
) -> Result<ManagedPrismInstall, CommandError> {
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

#[tauri::command]
pub async fn launch_instance(instance_name: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || prism::launch(&instance_name))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(())
}

#[tauri::command]
pub async fn launch_pack(
    pack_id: String,
    instance_name: Option<String>,
    option_preset_id: Option<String>,
) -> Result<(), CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let launch_profile = prism::load_launch_profile(&pack_id, &pack_dir)?;
    let manifest = manifest::load_from_path(&pack_dir.join("manifest.json"))?;
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let option_preset_selection =
        resolve_option_preset_selection(&pack_dir, option_preset_id.as_deref())?;
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        prism::ensure_instance_metadata(&instance_name, &manifest, &launch_profile)?;
        apply_launch_option_preset(&pack_dir, &instance_name, &option_preset_selection)?;
        prism::apply_launch_profile(&instance_name, &launch_profile)?;
        prism::launch(&instance_name)?;
        Ok(())
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;
    Ok(())
}

fn apply_launch_option_preset(
    pack_dir: &std::path::Path,
    instance_name: &str,
    selection: &OptionPresetSelection,
) -> Result<(), CommandError> {
    if matches!(selection, OptionPresetSelection::None) {
        return Ok(());
    }
    let categories = [
        OptionsSyncCategory::Keybinds,
        OptionsSyncCategory::Video,
        OptionsSyncCategory::Other,
    ];
    apply_options_sync(
        &pack_dir.join("options.txt"),
        instance_name,
        selection,
        &categories,
    )?;
    apply_shader_settings_sync(pack_dir, instance_name, selection)?;
    apply_option_preset_overrides(pack_dir, instance_name, selection)
}

#[tauri::command]
pub async fn set_instance_artifact_disabled(
    pack_id: String,
    category: ManifestArtifactCategory,
    filename: String,
    disabled: bool,
    instance_name: Option<String>,
) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || {
        set_instance_artifact_disabled_blocking(
            &pack_id,
            category,
            &filename,
            disabled,
            instance_name,
        )
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

fn set_instance_artifact_disabled_blocking(
    pack_id: &str,
    category: ManifestArtifactCategory,
    filename: &str,
    disabled: bool,
    instance_name: Option<String>,
) -> Result<(), CommandError> {
    if filename.contains('/') || filename.contains('\\') || filename.trim().is_empty() {
        return Err(CommandError::Other("invalid artifact filename".to_string()));
    }

    let pack_dir = paths::packs_dir()?.join(pack_id);
    let manifest = manifest::load_from_path(&pack_dir.join("manifest.json"))?;
    let entries = match category {
        ManifestArtifactCategory::Mods => &manifest.mods,
        ManifestArtifactCategory::Resourcepacks => &manifest.resourcepacks,
        ManifestArtifactCategory::Shaderpacks => &manifest.shaderpacks,
    };
    let canonical_filename = enabled_artifact_filename(filename).to_string();
    let entry = entries
        .iter()
        .find(|entry| enabled_artifact_filename(&entry.filename) == canonical_filename)
        .cloned();
    let Some(entry) = entry else {
        return Ok(());
    };

    if disabled && category == ManifestArtifactCategory::Mods && !entry.optional {
        return Err(CommandError::Other(
            "only optional mods can be disabled".to_string(),
        ));
    }

    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let minecraft_dir = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let artifact_dir = match category {
        ManifestArtifactCategory::Mods => minecraft_dir.join("mods"),
        ManifestArtifactCategory::Resourcepacks => minecraft_dir.join("resourcepacks"),
        ManifestArtifactCategory::Shaderpacks => minecraft_dir.join("shaderpacks"),
    };
    std::fs::create_dir_all(&artifact_dir)?;
    let enabled_path = artifact_dir.join(&canonical_filename);
    let disabled_path = artifact_dir.join(format!("{canonical_filename}.disabled"));

    if disabled {
        if enabled_path.exists() {
            if disabled_path.exists() {
                std::fs::remove_file(&disabled_path)?;
            }
            std::fs::rename(enabled_path, disabled_path)?;
        }
    } else if disabled_path.exists() {
        if enabled_path.exists() {
            std::fs::remove_file(&enabled_path)?;
        }
        std::fs::rename(disabled_path, enabled_path)?;
    }

    Ok(())
}

fn enabled_artifact_filename(filename: &str) -> &str {
    filename.strip_suffix(".disabled").unwrap_or(filename)
}

#[tauri::command]
pub async fn get_instance_minecraft_dir(
    instance_name: String,
) -> Result<Option<String>, CommandError> {
    Ok(prism::instance_minecraft_dir(&instance_name).map(|path| path.display().to_string()))
}

#[tauri::command]
pub async fn delete_prism_instance(instance_name: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || {
        let Some(instance_dir) = prism::instance_dir(&instance_name) else {
            return Ok(());
        };
        if instance_dir.exists() {
            std::fs::remove_dir_all(&instance_dir)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
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

fn normalize_optional_uuid(value: String) -> Result<Option<String>, CommandError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    uuid::Uuid::parse_str(trimmed)
        .map(|uuid| Some(uuid.hyphenated().to_string()))
        .map_err(|error| CommandError::Other(format!("invalid offline UUID: {error}")))
}
