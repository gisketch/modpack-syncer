//! App data paths.
//! Linux: ~/.local/share/modsync
//! macOS: ~/Library/Application Support/dev.gisketch.modsync
//! Windows: %APPDATA%\gisketch\modsync\data

use std::path::PathBuf;

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallDirectorySettings {
    pub default_dir: Option<String>,
    pub effective_dir: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredInstallDirectorySettings {
    default_dir: Option<String>,
}

pub fn project_dirs() -> anyhow::Result<ProjectDirs> {
    ProjectDirs::from("dev", "gisketch", "modsync")
        .ok_or_else(|| anyhow::anyhow!("could not resolve OS home directory"))
}

pub fn data_dir() -> anyhow::Result<PathBuf> {
    let p = install_directory_settings_pathless()?.effective_path;
    std::fs::create_dir_all(&p)?;
    Ok(p)
}

pub fn install_directory_settings() -> anyhow::Result<InstallDirectorySettings> {
    let settings = install_directory_settings_pathless()?;
    Ok(InstallDirectorySettings {
        default_dir: settings.default_dir,
        effective_dir: settings.effective_path.display().to_string(),
    })
}

pub fn set_install_directory(
    default_dir: Option<String>,
) -> anyhow::Result<InstallDirectorySettings> {
    let default_dir = default_dir.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed).display().to_string())
        }
    });

    if let Some(path) = default_dir.as_ref() {
        std::fs::create_dir_all(path)?;
    }

    let stored = StoredInstallDirectorySettings {
        default_dir: default_dir.clone(),
    };
    let path = install_directory_settings_file()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(&stored)?)?;
    install_directory_settings()
}

struct PathlessInstallDirectorySettings {
    default_dir: Option<String>,
    effective_path: PathBuf,
}

fn install_directory_settings_pathless() -> anyhow::Result<PathlessInstallDirectorySettings> {
    let stored = read_stored_install_directory_settings()?;
    let effective_path = match stored.default_dir.as_ref() {
        Some(default_dir) => PathBuf::from(default_dir),
        None => project_dirs()?.data_dir().to_path_buf(),
    };
    Ok(PathlessInstallDirectorySettings {
        default_dir: stored.default_dir,
        effective_path,
    })
}

fn read_stored_install_directory_settings() -> anyhow::Result<StoredInstallDirectorySettings> {
    let path = install_directory_settings_file()?;
    if !path.exists() {
        return Ok(StoredInstallDirectorySettings::default());
    }
    let text = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&text).unwrap_or_default())
}

fn install_directory_settings_file() -> anyhow::Result<PathBuf> {
    let dirs = project_dirs()?;
    let path = dirs.config_dir().join("install-directory.json");
    Ok(path)
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
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}
