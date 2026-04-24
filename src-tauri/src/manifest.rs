//! Manifest parsing + validation.
//! Represents `manifest.json` in the pack repo.
//! See docs/architecture.md §2.3.

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
    Minio,
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
    pub filename: String,
    pub sha1: String,
    #[serde(default)]
    pub sha512: Option<String>,
    pub size: u64,
    pub url: String,
    #[serde(default)]
    pub optional: bool,
    #[serde(default = "default_side")]
    pub side: Side,
}

fn default_side() -> Side {
    Side::Client
}
