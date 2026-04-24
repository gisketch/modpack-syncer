//! Per-profile configuration.
//! See docs/architecture.md §2.4.

use serde::{Deserialize, Serialize};

use crate::manifest::Loader;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub pack: String,
    #[serde(default = "default_ref")]
    pub r#ref: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    pub loader: Loader,
    pub sync: SyncToggles,
    pub java: JavaConfig,
    #[serde(rename = "prismInstanceName")]
    pub prism_instance_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncToggles {
    #[serde(default = "t")]
    pub mods: bool,
    #[serde(default = "t")]
    pub configs: bool,
    #[serde(default = "t")]
    pub kubejs: bool,
    #[serde(default = "t")]
    pub resourcepacks: bool,
    #[serde(default = "t")]
    pub shaderpacks: bool,
    #[serde(default)]
    pub keybinds: bool,
    #[serde(default)]
    pub servers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaConfig {
    pub version: u32,
    #[serde(default = "t", rename = "autoDownload")]
    pub auto_download: bool,
    pub xms: String,
    pub xmx: String,
    #[serde(default, rename = "extraArgs")]
    pub extra_args: Vec<String>,
}

fn t() -> bool {
    true
}
fn default_ref() -> String {
    "main".to_string()
}
