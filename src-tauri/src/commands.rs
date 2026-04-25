//! Tauri commands exposed to the frontend.
//! Keep this in sync with `src/lib/tauri.ts`.

use serde::{Deserialize, Serialize};

use crate::{download, git, manifest, prism};

pub(crate) mod changelog;
pub(crate) mod modrinth;
pub(crate) mod option_presets;
pub(crate) mod packs;
pub(crate) mod prism_control;
pub(crate) mod publish;
pub(crate) mod publish_auth;
pub(crate) mod status;
pub(crate) mod sync;
pub(crate) mod sync_review;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CommandError {
    Git(String),
    Manifest(String),
    Io(String),
    Prism(String),
    Download(String),
    Other(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublishCategory {
    Mods,
    Resourcepacks,
    Shaderpacks,
    ShaderSettings,
    OptionPresets,
    Config,
    Kubejs,
    Root,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublishAction {
    Add,
    Update,
    Remove,
    Unchanged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishScanItem {
    pub category: PublishCategory,
    pub relative_path: String,
    pub size: Option<u64>,
    pub sha1: Option<String>,
    pub action: PublishAction,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishScanReport {
    pub instance_dir: String,
    pub items: Vec<PublishScanItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishApplyReport {
    pub manifest_entries_written: usize,
    pub repo_files_written: usize,
    pub repo_files_removed: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishPushReport {
    pub commit_sha: String,
    pub method: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ManifestArtifactCategory {
    Mods,
    Resourcepacks,
    Shaderpacks,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishAuthSettings {
    pub method: Option<String>,
    pub has_pat: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishSshStatus {
    pub verified: bool,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackChangelogItem {
    pub action: PublishAction,
    pub category: PublishCategory,
    pub count: usize,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackChangelogEntry {
    pub commit_sha: String,
    pub pack_version: String,
    pub title: String,
    pub description: String,
    pub committed_at: i64,
    pub items: Vec<PackChangelogItem>,
}

impl From<git::GitError> for CommandError {
    fn from(e: git::GitError) -> Self {
        Self::Git(e.to_string())
    }
}
impl From<git2::Error> for CommandError {
    fn from(e: git2::Error) -> Self {
        Self::Git(e.to_string())
    }
}
impl From<manifest::ManifestError> for CommandError {
    fn from(e: manifest::ManifestError) -> Self {
        Self::Manifest(e.to_string())
    }
}
impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}
impl From<anyhow::Error> for CommandError {
    fn from(e: anyhow::Error) -> Self {
        Self::Other(e.to_string())
    }
}
impl From<prism::PrismError> for CommandError {
    fn from(e: prism::PrismError) -> Self {
        Self::Prism(e.to_string())
    }
}
impl From<download::DownloadError> for CommandError {
    fn from(e: download::DownloadError) -> Self {
        Self::Download(e.to_string())
    }
}
