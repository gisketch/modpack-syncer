use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{paths, prism};

use super::sync_review::{
    classify_option_key, read_options_map, read_properties_map, OptionsSyncCategory,
};
use super::CommandError;

pub const PACK_DEFAULT_PRESET_ID: &str = "__pack-default";
pub const NO_OPTION_PRESET_ID: &str = "__none";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPreset {
    pub id: String,
    pub label: String,
    pub description: String,
    #[serde(default)]
    pub options: OptionPresetOptions,
    #[serde(default)]
    pub shader: Option<OptionPresetShader>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetOptions {
    #[serde(default)]
    pub video: BTreeMap<String, String>,
    #[serde(default)]
    pub keybinds: BTreeMap<String, String>,
    #[serde(default)]
    pub other: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetShader {
    #[serde(default)]
    pub shader_pack: Option<String>,
    #[serde(default)]
    pub iris: BTreeMap<String, String>,
    #[serde(default)]
    pub preset: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetSummary {
    pub id: String,
    pub label: String,
    pub description: String,
    pub counts: OptionPresetCounts,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetCounts {
    pub video: usize,
    pub keybinds: usize,
    pub other: usize,
    pub shader: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum OptionPresetScope {
    Video,
    Keybinds,
    Other,
    ShaderIris,
    ShaderPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetRow {
    pub scope: OptionPresetScope,
    pub key: String,
    pub value: String,
    pub included: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionPresetCapture {
    pub rows: Vec<OptionPresetRow>,
    pub shader_pack: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOptionPresetDraft {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub shader_pack: Option<String>,
    pub rows: Vec<OptionPresetRow>,
}

pub enum OptionPresetSelection {
    PackDefault,
    None,
    Preset(OptionPreset),
}

#[tauri::command]
pub async fn list_option_presets(
    pack_id: String,
) -> Result<Vec<OptionPresetSummary>, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || list_option_presets_from_pack(&pack_dir))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn capture_option_preset(
    pack_id: String,
    instance_name: Option<String>,
) -> Result<OptionPresetCapture, CommandError> {
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let instance_root = prism::instance_minecraft_dir(&instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    tokio::task::spawn_blocking(move || capture_option_preset_from_instance(&instance_root))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn save_option_preset(
    pack_id: String,
    draft: SaveOptionPresetDraft,
) -> Result<OptionPresetSummary, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    tokio::task::spawn_blocking(move || save_option_preset_to_pack(&pack_dir, draft))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
}

pub fn resolve_option_preset_selection(
    pack_dir: &Path,
    preset_id: Option<&str>,
) -> Result<OptionPresetSelection, CommandError> {
    match preset_id.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some(PACK_DEFAULT_PRESET_ID) => Ok(OptionPresetSelection::PackDefault),
        Some(NO_OPTION_PRESET_ID) => Ok(OptionPresetSelection::None),
        Some(id) => {
            let path = option_preset_path(pack_dir, id)?;
            if !path.exists() {
                return Ok(OptionPresetSelection::PackDefault);
            }
            Ok(OptionPresetSelection::Preset(load_option_preset_path(
                &path,
            )?))
        }
    }
}

pub fn apply_option_preset_to_options_map(
    mut options: BTreeMap<String, String>,
    preset: &OptionPreset,
) -> BTreeMap<String, String> {
    for (key, value) in preset
        .options
        .video
        .iter()
        .chain(preset.options.keybinds.iter())
        .chain(preset.options.other.iter())
    {
        options.insert(key.clone(), value.clone());
    }
    options
}

pub fn apply_option_preset_to_shader_maps(
    iris: &mut BTreeMap<String, String>,
    preset_map: &mut BTreeMap<String, String>,
    preset: &OptionPreset,
) {
    let Some(shader) = preset.shader.as_ref() else {
        return;
    };
    if let Some(shader_pack) = shader.shader_pack.as_ref() {
        iris.insert("shaderPack".to_string(), shader_pack.clone());
        iris.insert("enableShaders".to_string(), "true".to_string());
    }
    for (key, value) in &shader.iris {
        iris.insert(key.clone(), value.clone());
    }
    for (key, value) in &shader.preset {
        preset_map.insert(key.clone(), value.clone());
    }
}

pub fn preset_summary(preset: &OptionPreset) -> OptionPresetSummary {
    let shader_count = preset
        .shader
        .as_ref()
        .map(|shader| {
            shader.iris.len() + shader.preset.len() + usize::from(shader.shader_pack.is_some())
        })
        .unwrap_or(0);
    OptionPresetSummary {
        id: preset.id.clone(),
        label: preset.label.clone(),
        description: preset.description.clone(),
        counts: OptionPresetCounts {
            video: preset.options.video.len(),
            keybinds: preset.options.keybinds.len(),
            other: preset.options.other.len(),
            shader: shader_count,
        },
    }
}

fn list_option_presets_from_pack(
    pack_dir: &Path,
) -> Result<Vec<OptionPresetSummary>, CommandError> {
    let presets_dir = pack_dir.join("presets");
    if !presets_dir.exists() {
        return Ok(Vec::new());
    }
    let mut presets = Vec::new();
    for entry in std::fs::read_dir(presets_dir)? {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let bytes = std::fs::read(&path)?;
        let preset = serde_json::from_slice::<OptionPreset>(&bytes).map_err(|error| {
            CommandError::Other(format!(
                "failed to read option preset {}: {error}",
                path.display()
            ))
        })?;
        presets.push(preset_summary(&preset));
    }
    presets.sort_by(|left, right| left.label.cmp(&right.label));
    Ok(presets)
}

fn load_option_preset_path(path: &Path) -> Result<OptionPreset, CommandError> {
    let bytes = std::fs::read(&path).map_err(|error| {
        CommandError::Other(format!(
            "failed to read option preset {}: {error}",
            path.display()
        ))
    })?;
    serde_json::from_slice::<OptionPreset>(&bytes).map_err(|error| {
        CommandError::Other(format!(
            "failed to parse option preset {}: {error}",
            path.display()
        ))
    })
}

fn option_preset_path(pack_dir: &Path, preset_id: &str) -> Result<PathBuf, CommandError> {
    let id = sanitize_preset_id(preset_id)?;
    Ok(pack_dir.join("presets").join(format!("{id}.json")))
}

fn capture_option_preset_from_instance(
    instance_root: &Path,
) -> Result<OptionPresetCapture, CommandError> {
    let mut rows = Vec::new();
    let options = read_options_map(&instance_root.join("options.txt"))?;
    for (key, value) in options {
        let category = classify_option_key(&key);
        let (scope, included) = match category {
            OptionsSyncCategory::Video => (OptionPresetScope::Video, true),
            OptionsSyncCategory::Keybinds => (OptionPresetScope::Keybinds, false),
            OptionsSyncCategory::Other => (OptionPresetScope::Other, false),
        };
        rows.push(OptionPresetRow {
            scope,
            key,
            value,
            included,
            source: "options.txt".to_string(),
        });
    }

    let iris_path = instance_root.join("config/iris.properties");
    let iris = read_properties_map(&iris_path)?;
    let shader_pack = iris.get("shaderPack").cloned();
    for (key, value) in iris {
        rows.push(OptionPresetRow {
            scope: OptionPresetScope::ShaderIris,
            key,
            value,
            included: true,
            source: "config/iris.properties".to_string(),
        });
    }

    if let Some(shader_pack) = shader_pack.as_ref() {
        let preset_path = instance_root
            .join("shaderpacks")
            .join(format!("{shader_pack}.txt"));
        for (key, value) in read_properties_map(&preset_path)? {
            rows.push(OptionPresetRow {
                scope: OptionPresetScope::ShaderPreset,
                key,
                value,
                included: true,
                source: format!("shaderpacks/{shader_pack}.txt"),
            });
        }
    }

    rows.sort_by(|left, right| {
        (left.scope, left.key.as_str()).cmp(&(right.scope, right.key.as_str()))
    });
    Ok(OptionPresetCapture { rows, shader_pack })
}

fn save_option_preset_to_pack(
    pack_dir: &Path,
    draft: SaveOptionPresetDraft,
) -> Result<OptionPresetSummary, CommandError> {
    let id = sanitize_preset_id(&draft.id)?;
    let label = draft.label.trim();
    if label.is_empty() {
        return Err(CommandError::Other("preset label is required".to_string()));
    }

    let mut preset = OptionPreset {
        id: id.clone(),
        label: label.to_string(),
        description: draft.description.trim().to_string(),
        options: OptionPresetOptions::default(),
        shader: None,
    };
    let mut shader = OptionPresetShader {
        shader_pack: draft.shader_pack.filter(|value| !value.trim().is_empty()),
        ..OptionPresetShader::default()
    };

    let mut seen = BTreeSet::new();
    for row in draft.rows.into_iter().filter(|row| row.included) {
        if !seen.insert((row.scope, row.key.clone())) {
            continue;
        }
        match row.scope {
            OptionPresetScope::Video => {
                preset.options.video.insert(row.key, row.value);
            }
            OptionPresetScope::Keybinds => {
                preset.options.keybinds.insert(row.key, row.value);
            }
            OptionPresetScope::Other => {
                preset.options.other.insert(row.key, row.value);
            }
            OptionPresetScope::ShaderIris => {
                if row.key == "shaderPack" {
                    shader.shader_pack = Some(row.value.clone());
                }
                shader.iris.insert(row.key, row.value);
            }
            OptionPresetScope::ShaderPreset => {
                shader.preset.insert(row.key, row.value);
            }
        }
    }

    if shader.shader_pack.is_some() || !shader.iris.is_empty() || !shader.preset.is_empty() {
        preset.shader = Some(shader);
    }

    let presets_dir = pack_dir.join("presets");
    std::fs::create_dir_all(&presets_dir)?;
    let path = presets_dir.join(format!("{id}.json"));
    let bytes = serde_json::to_vec_pretty(&preset)
        .map_err(|error| CommandError::Other(error.to_string()))?;
    std::fs::write(path, bytes)?;
    Ok(preset_summary(&preset))
}

fn sanitize_preset_id(value: &str) -> Result<String, CommandError> {
    let id = value.trim().to_ascii_lowercase().replace(' ', "-");
    if id.is_empty() {
        return Err(CommandError::Other("preset id is required".to_string()));
    }
    if !id
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
    {
        return Err(CommandError::Other(
            "preset id may only contain letters, numbers, dashes, and underscores".to_string(),
        ));
    }
    if id == PACK_DEFAULT_PRESET_ID || id == NO_OPTION_PRESET_ID {
        return Err(CommandError::Other("preset id is reserved".to_string()));
    }
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_selected_preset_falls_back_to_pack_default() {
        let pack_dir = std::env::temp_dir().join(format!(
            "modsync-missing-preset-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock before epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(pack_dir.join("presets")).expect("create temp preset dir");

        let selection = resolve_option_preset_selection(&pack_dir, Some("medium"))
            .expect("missing preset resolves");

        assert!(matches!(selection, OptionPresetSelection::PackDefault));
        let _ = std::fs::remove_dir_all(pack_dir);
    }
}
