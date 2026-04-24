//! App data paths.
//! Linux: ~/.local/share/modsync
//! macOS: ~/Library/Application Support/dev.gisketch.modsync
//! Windows: %APPDATA%\gisketch\modsync\data

use std::path::PathBuf;

use directories::ProjectDirs;

pub fn project_dirs() -> anyhow::Result<ProjectDirs> {
    ProjectDirs::from("dev", "gisketch", "modsync")
        .ok_or_else(|| anyhow::anyhow!("could not resolve OS home directory"))
}

pub fn data_dir() -> anyhow::Result<PathBuf> {
    let dirs = project_dirs()?;
    let p = dirs.data_dir().to_path_buf();
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
