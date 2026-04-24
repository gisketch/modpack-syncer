//! App data paths.
//! Linux: ~/.local/share/modsync
//! macOS: ~/Library/Application Support/dev.gisketch.modsync
//! Windows: %APPDATA%\gisketch\modsync\data

use std::path::PathBuf;

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStorageSettings {
    pub default_data_dir: String,
    pub data_dir: String,
    pub override_data_dir: Option<String>,
    pub is_default: bool,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppStorageSettingsFile {
    pub override_data_dir: Option<String>,
    pub confirmed: bool,
}

pub fn project_dirs() -> anyhow::Result<ProjectDirs> {
    ProjectDirs::from("dev", "gisketch", "modsync")
        .ok_or_else(|| anyhow::anyhow!("could not resolve OS home directory"))
}

fn default_data_dir() -> anyhow::Result<PathBuf> {
    Ok(project_dirs()?.data_dir().to_path_buf())
}

fn app_storage_settings_path() -> anyhow::Result<PathBuf> {
    let path = project_dirs()?.config_dir().join("app-storage.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(path)
}

fn load_app_storage_settings_file() -> anyhow::Result<AppStorageSettingsFile> {
    let path = app_storage_settings_path()?;
    if !path.exists() {
        return Ok(AppStorageSettingsFile::default());
    }
    let bytes = std::fs::read(path)?;
    let settings = serde_json::from_slice::<AppStorageSettingsFile>(&bytes)?;
    Ok(settings)
}

pub fn get_app_storage_settings() -> anyhow::Result<AppStorageSettings> {
    let default_dir = default_data_dir()?;
    let settings = load_app_storage_settings_file()?;
    let effective_dir = settings
        .override_data_dir
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| default_dir.clone());
    std::fs::create_dir_all(&effective_dir)?;
    Ok(AppStorageSettings {
        default_data_dir: default_dir.display().to_string(),
        data_dir: effective_dir.display().to_string(),
        override_data_dir: settings.override_data_dir,
        is_default: effective_dir == default_dir,
        confirmed: settings.confirmed,
    })
}

pub fn set_app_storage_settings(override_data_dir: Option<String>, confirmed: bool) -> anyhow::Result<AppStorageSettings> {
    let path = app_storage_settings_path()?;
    let effective_dir = override_data_dir
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or(default_data_dir()?);
    std::fs::create_dir_all(&effective_dir)?;
    let bytes = serde_json::to_vec_pretty(&AppStorageSettingsFile {
        override_data_dir,
        confirmed,
    })?;
    std::fs::write(path, bytes)?;
    get_app_storage_settings()
}

pub fn data_dir() -> anyhow::Result<PathBuf> {
    let p = PathBuf::from(get_app_storage_settings()?.data_dir);
    std::fs::create_dir_all(&p)?;
    Ok(p)
}

pub fn packs_dir() -> anyhow::Result<PathBuf> {
    let p = data_dir()?.join("packs");
    std::fs::create_dir_all(&p)?;
    Ok(p)
}

pub fn cache_dir() -> anyhow::Result<PathBuf> {
    let p = data_dir()?.join("cache");
    std::fs::create_dir_all(&p)?;
    Ok(p)
}

pub fn publish_auth_path() -> anyhow::Result<PathBuf> {
    Ok(data_dir()?.join("publish-auth.json"))
}

pub fn prism_settings_path() -> anyhow::Result<PathBuf> {
    Ok(data_dir()?.join("prism-settings.json"))
}

pub fn launch_profiles_dir() -> anyhow::Result<PathBuf> {
    let path = data_dir()?.join("launch-profiles");
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn launch_profile_path(pack_id: &str) -> anyhow::Result<PathBuf> {
    Ok(launch_profiles_dir()?.join(format!("{pack_id}.json")))
}

pub fn managed_java_runtimes_dir() -> anyhow::Result<PathBuf> {
    let path = data_dir()?.join("java-runtimes");
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn managed_launchers_dir() -> anyhow::Result<PathBuf> {
    let path = data_dir()?.join("launchers");
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn managed_prism_dir() -> anyhow::Result<PathBuf> {
    let path = managed_launchers_dir()?.join("prismlauncher-cracked");
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

/// Derive a filesystem-safe pack id from a clone URL.
pub fn pack_id_from_url(url: &str) -> String {
    let stripped = url
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .rsplit(['/', ':'])
        .next()
        .unwrap_or("pack");
    stripped
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
