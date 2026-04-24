//! Manifest parsing + validation.
//! Represents `manifest.json` in the pack repo.
//! See docs/architecture.md §2.3.

use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub pack: PackMeta,
    #[serde(default)]
    pub mods: Vec<Entry>,
    #[serde(default)]
    pub resourcepacks: Vec<Entry>,
    #[serde(default)]
    pub shaderpacks: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMeta {
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub version: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    pub loader: Loader,
    #[serde(rename = "loaderVersion")]
    pub loader_version: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Loader {
    NeoForge,
    Fabric,
    Forge,
    Quilt,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Modrinth,
    Curseforge,
    Url,
    Repo,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Client,
    Server,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub source: Source,
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "versionId")]
    pub version_id: Option<String>,
    #[serde(default, rename = "repoPath")]
    pub repo_path: Option<String>,
    pub filename: String,
    pub sha1: String,
    #[serde(default)]
    pub sha512: Option<String>,
    pub size: u64,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub optional: bool,
    #[serde(default = "default_side")]
    pub side: Side,
}

fn default_side() -> Side {
    Side::Client
}

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("manifest file not found at {0}")]
    NotFound(String),
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unsupported schemaVersion {found} (supported: {supported})")]
    UnsupportedSchema { found: u32, supported: u32 },
}

pub fn load_from_path(path: &Path) -> Result<Manifest, ManifestError> {
    if !path.exists() {
        return Err(ManifestError::NotFound(path.display().to_string()));
    }
    let bytes = std::fs::read(path)?;
    let manifest: Manifest = serde_json::from_slice(&bytes)?;
    if manifest.schema_version != CURRENT_SCHEMA_VERSION {
        return Err(ManifestError::UnsupportedSchema {
            found: manifest.schema_version,
            supported: CURRENT_SCHEMA_VERSION,
        });
    }
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_manifest() {
        let json = r#"{
            "schemaVersion": 1,
            "pack": {
                "name": "demo",
                "icon": "https://example.com/icon.png",
                "version": "0.1.0",
                "mcVersion": "1.21.1",
                "loader": "neoforge",
                "loaderVersion": "21.1.77"
            },
            "mods": [{
                "id": "sodium",
                "source": "modrinth",
                "projectId": "AANobbMI",
                "versionId": "Yp8wLY1P",
                "filename": "sodium.jar",
                "sha1": "deadbeef",
                "size": 123,
                "url": "https://cdn.modrinth.com/data/sodium.jar"
            }]
        }"#;
        let m: Manifest = serde_json::from_str(json).unwrap();
        assert_eq!(m.schema_version, 1);
        assert_eq!(m.pack.icon.as_deref(), Some("https://example.com/icon.png"));
        assert_eq!(m.pack.loader, Loader::NeoForge);
        assert_eq!(m.mods.len(), 1);
        assert_eq!(m.mods[0].source, Source::Modrinth);
        assert_eq!(m.mods[0].side, Side::Client);
    }

    #[test]
    fn parses_repo_entry() {
        let json = r#"{
            "schemaVersion": 1,
            "pack": {
                "name": "demo",
                "version": "0.1.0",
                "mcVersion": "1.21.1",
                "loader": "fabric",
                "loaderVersion": "0.16.10"
            },
            "mods": [{
                "id": "local-mod",
                "source": "repo",
                "repoPath": "mods/local-mod.jar",
                "filename": "local-mod.jar",
                "sha1": "deadbeef",
                "size": 123,
                "url": ""
            }]
        }"#;
        let m: Manifest = serde_json::from_str(json).unwrap();
        assert_eq!(m.mods[0].source, Source::Repo);
        assert_eq!(m.mods[0].repo_path.as_deref(), Some("mods/local-mod.jar"));
    }
}
