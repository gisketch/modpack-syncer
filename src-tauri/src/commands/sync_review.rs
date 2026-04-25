use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::Serialize;

use crate::prism;

use super::option_presets::{
    apply_option_preset_to_options_map, apply_option_preset_to_shader_maps, OptionPresetSelection,
};
use super::{CommandError, PublishAction};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum OptionsSyncCategory {
    Keybinds,
    Video,
    Other,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionsSyncChange {
    pub category: OptionsSyncCategory,
    pub key: String,
    pub pack_value: Option<String>,
    pub instance_value: Option<String>,
    pub action: PublishAction,
    pub ignored: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionsSyncGroup {
    pub category: OptionsSyncCategory,
    pub label: String,
    pub description: String,
    pub changes: Vec<OptionsSyncChange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionsSyncPreview {
    pub has_pack_file: bool,
    pub has_instance_file: bool,
    pub groups: Vec<OptionsSyncGroup>,
    pub ignored_keys: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShaderSettingsStatus {
    MissingPackConfig,
    Matched,
    Mismatch,
    DisabledLocal,
    MissingPreset,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderSettingsPreview {
    pub status: ShaderSettingsStatus,
    pub has_pack_iris_file: bool,
    pub has_instance_iris_file: bool,
    pub pack_shader_pack: Option<String>,
    pub local_shader_pack: Option<String>,
    pub pack_shaders_enabled: bool,
    pub local_shaders_enabled: bool,
    pub pack_preset_path: Option<String>,
    pub local_preset_path: Option<String>,
    pub iris_diff_count: usize,
    pub preset_diff_count: usize,
    pub iris_changes: Vec<ShaderSettingsChange>,
    pub preset_changes: Vec<ShaderSettingsChange>,
    pub requires_decision: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderSettingsChange {
    pub key: String,
    pub pack_value: Option<String>,
    pub instance_value: Option<String>,
    pub action: PublishAction,
}

pub fn build_options_sync_preview(
    pack_path: &Path,
    instance_path: &Path,
    selection: &OptionPresetSelection,
) -> Result<OptionsSyncPreview, CommandError> {
    let has_pack_file = pack_path.exists() || matches!(selection, OptionPresetSelection::Preset(_));
    let has_instance_file = instance_path.exists();
    let mut pack_map = read_options_map(pack_path)?;
    let instance_map = read_options_map(instance_path)?;
    let ignored_set = read_options_ignore_set(
        instance_path
            .parent()
            .ok_or_else(|| CommandError::Other("invalid options path".to_string()))?,
    )?;

    match selection {
        OptionPresetSelection::PackDefault => {}
        OptionPresetSelection::None => {
            return Ok(OptionsSyncPreview {
                has_pack_file,
                has_instance_file,
                groups: options_sync_groups(Vec::new(), Vec::new(), Vec::new()),
                ignored_keys: ignored_set.into_iter().collect(),
            });
        }
        OptionPresetSelection::Preset(preset) => {
            pack_map = apply_option_preset_to_options_map(pack_map, preset);
        }
    }

    let mut keybinds = Vec::new();
    let mut video = Vec::new();
    let mut other = Vec::new();
    let keys = pack_map
        .keys()
        .chain(instance_map.keys())
        .cloned()
        .collect::<BTreeSet<_>>();

    for key in keys {
        let pack_value = pack_map.get(&key);
        let instance_value = instance_map.get(&key);
        if pack_value == instance_value {
            continue;
        }
        let change = OptionsSyncChange {
            category: classify_option_key(&key),
            key: key.clone(),
            pack_value: pack_value.cloned(),
            instance_value: instance_value.cloned(),
            action: match (pack_value, instance_value) {
                (Some(_), Some(_)) => PublishAction::Update,
                (Some(_), None) => PublishAction::Remove,
                (None, Some(_)) => PublishAction::Add,
                (None, None) => continue,
            },
            ignored: ignored_set.contains(&key),
        };

        match change.category {
            OptionsSyncCategory::Keybinds => keybinds.push(change),
            OptionsSyncCategory::Video => video.push(change),
            OptionsSyncCategory::Other => other.push(change),
        }
    }

    Ok(OptionsSyncPreview {
        has_pack_file,
        has_instance_file,
        groups: options_sync_groups(keybinds, video, other),
        ignored_keys: ignored_set.into_iter().collect(),
    })
}

pub fn set_options_ignored(
    instance_root: &Path,
    key: String,
    ignored: bool,
) -> Result<Vec<String>, CommandError> {
    let mut ignored_keys = read_options_ignore_set(instance_root)?;
    if ignored {
        ignored_keys.insert(key);
    } else {
        ignored_keys.remove(&key);
    }
    write_options_ignore_set(instance_root, &ignored_keys)?;
    Ok(ignored_keys.into_iter().collect())
}

pub fn build_shader_settings_preview(
    pack_dir: &Path,
    instance_root: &Path,
    selection: &OptionPresetSelection,
) -> Result<ShaderSettingsPreview, CommandError> {
    let pack_iris_path = pack_dir.join("configs/iris.properties");
    let instance_iris_path = instance_root.join("config/iris.properties");
    let has_preset_shader =
        matches!(selection, OptionPresetSelection::Preset(preset) if preset.shader.is_some());
    let has_pack_iris_file = pack_iris_path.exists() || has_preset_shader;
    let has_instance_iris_file = instance_iris_path.exists();
    let mut pack_iris = read_properties_map(&pack_iris_path)?;
    if let OptionPresetSelection::Preset(preset) = selection {
        if let Some(shader) = preset.shader.as_ref() {
            if let Some(shader_pack) = shader.shader_pack.as_ref() {
                pack_iris.insert("shaderPack".to_string(), shader_pack.clone());
                pack_iris.insert("enableShaders".to_string(), "true".to_string());
            }
            for (key, value) in &shader.iris {
                pack_iris.insert(key.clone(), value.clone());
            }
        }
    }
    let instance_iris = read_properties_map(&instance_iris_path)?;
    let pack_shader_pack = pack_iris.get("shaderPack").cloned();
    let local_shader_pack = instance_iris.get("shaderPack").cloned();
    let pack_shaders_enabled = parse_bool_property(pack_iris.get("enableShaders"));
    let local_shaders_enabled = parse_bool_property(instance_iris.get("enableShaders"));
    let pack_preset = pack_shader_pack
        .as_ref()
        .map(|name| pack_dir.join("shaderpacks").join(format!("{name}.txt")));
    let local_preset = local_shader_pack.as_ref().map(|name| {
        instance_root
            .join("shaderpacks")
            .join(format!("{name}.txt"))
    });

    let mut pack_preset_map = match pack_preset.as_ref() {
        Some(path) => read_properties_map(path)?,
        None => BTreeMap::new(),
    };
    if let OptionPresetSelection::Preset(preset) = selection {
        if let Some(shader) = preset.shader.as_ref() {
            for (key, value) in &shader.preset {
                pack_preset_map.insert(key.clone(), value.clone());
            }
        }
    }
    let has_pack_preset_values = pack_preset.as_ref().is_some_and(|path| path.exists())
        || matches!(selection, OptionPresetSelection::Preset(preset) if preset
            .shader
            .as_ref()
            .is_some_and(|shader| !shader.preset.is_empty()));
    let local_preset_map = match local_preset.as_ref() {
        Some(path) => read_properties_map(path)?,
        None => BTreeMap::new(),
    };

    let status = if !has_pack_iris_file {
        ShaderSettingsStatus::MissingPackConfig
    } else if !local_shaders_enabled {
        ShaderSettingsStatus::DisabledLocal
    } else if pack_shader_pack != local_shader_pack {
        ShaderSettingsStatus::Mismatch
    } else if !has_pack_preset_values {
        ShaderSettingsStatus::MissingPreset
    } else {
        ShaderSettingsStatus::Matched
    };

    let iris_changes = build_property_changes(&pack_iris, &instance_iris);
    let preset_changes = build_property_changes(&pack_preset_map, &local_preset_map);
    let iris_diff_count = iris_changes.len();
    let preset_diff_count = preset_changes.len();

    Ok(ShaderSettingsPreview {
        status,
        has_pack_iris_file,
        has_instance_iris_file,
        pack_shader_pack,
        local_shader_pack,
        pack_shaders_enabled,
        local_shaders_enabled,
        pack_preset_path: pack_preset
            .filter(|path| path.exists())
            .map(|path| path.display().to_string()),
        local_preset_path: local_preset
            .filter(|path| path.exists())
            .map(|path| path.display().to_string()),
        iris_diff_count,
        preset_diff_count,
        iris_changes,
        preset_changes,
        requires_decision: has_pack_iris_file
            && (iris_diff_count > 0
                || preset_diff_count > 0
                || !local_shaders_enabled
                || status_matches_requires_decision(&status)),
    })
}

pub fn apply_options_sync(
    pack_options_path: &Path,
    instance_name: &str,
    selection: &OptionPresetSelection,
) -> Result<(), CommandError> {
    if matches!(selection, OptionPresetSelection::None) {
        return Ok(());
    }
    let instance_root = prism::instance_minecraft_dir(instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let instance_options_path = instance_root.join("options.txt");
    let mut pack_map = read_options_map(pack_options_path)?;
    if let OptionPresetSelection::Preset(preset) = selection {
        pack_map = apply_option_preset_to_options_map(pack_map, preset);
    } else if !pack_options_path.exists() {
        return Ok(());
    }
    let mut merged = read_options_map(&instance_options_path)?;
    let ignored_set = read_options_ignore_set(&instance_root)?;

    for key in pack_map
        .keys()
        .chain(merged.keys())
        .cloned()
        .collect::<BTreeSet<_>>()
    {
        if ignored_set.contains(&key) {
            continue;
        }
        match pack_map.get(&key) {
            Some(value) => {
                merged.insert(key, value.clone());
            }
            None => {
                merged.remove(&key);
            }
        }
    }

    write_options_map(&instance_options_path, &merged)
}

pub fn apply_shader_settings_sync(
    pack_dir: &Path,
    instance_name: &str,
    selection: &OptionPresetSelection,
) -> Result<(), CommandError> {
    let instance_root = prism::instance_minecraft_dir(instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    let pack_iris_path = pack_dir.join("configs/iris.properties");
    if !pack_iris_path.exists()
        && !matches!(selection, OptionPresetSelection::Preset(preset) if preset.shader.is_some())
    {
        return Ok(());
    }
    let instance_config_dir = instance_root.join("config");
    std::fs::create_dir_all(&instance_config_dir)?;

    if !matches!(selection, OptionPresetSelection::Preset(_)) {
        std::fs::copy(&pack_iris_path, instance_config_dir.join("iris.properties"))?;
    }

    let mut pack_iris = read_properties_map(&pack_iris_path)?;
    let mut preset_map = BTreeMap::new();
    if let OptionPresetSelection::Preset(preset) = selection {
        apply_option_preset_to_shader_maps(&mut pack_iris, &mut preset_map, preset);
        write_properties_map(&instance_config_dir.join("iris.properties"), &pack_iris)?;
    }
    if let Some(shader_pack) = pack_iris.get("shaderPack") {
        let pack_preset_path = pack_dir
            .join("shaderpacks")
            .join(format!("{shader_pack}.txt"));
        if matches!(selection, OptionPresetSelection::Preset(_)) {
            let mut merged_preset = read_properties_map(&pack_preset_path)?;
            merged_preset.extend(preset_map);
            if !merged_preset.is_empty() {
                let instance_shader_dir = instance_root.join("shaderpacks");
                write_properties_map(
                    &instance_shader_dir.join(format!("{shader_pack}.txt")),
                    &merged_preset,
                )?;
            }
            return Ok(());
        }
        if pack_preset_path.exists() {
            let instance_shader_dir = instance_root.join("shaderpacks");
            std::fs::create_dir_all(&instance_shader_dir)?;
            std::fs::copy(
                pack_preset_path,
                instance_shader_dir.join(format!("{shader_pack}.txt")),
            )?;
        }
    }
    Ok(())
}

fn options_sync_groups(
    keybinds: Vec<OptionsSyncChange>,
    video: Vec<OptionsSyncChange>,
    other: Vec<OptionsSyncChange>,
) -> Vec<OptionsSyncGroup> {
    vec![
        OptionsSyncGroup {
            category: OptionsSyncCategory::Keybinds,
            label: "KEYBINDS".to_string(),
            description: "Changed key mappings from options preset.".to_string(),
            changes: keybinds,
        },
        OptionsSyncGroup {
            category: OptionsSyncCategory::Video,
            label: "VIDEO SETTINGS".to_string(),
            description: "Changed visual and rendering settings.".to_string(),
            changes: video,
        },
        OptionsSyncGroup {
            category: OptionsSyncCategory::Other,
            label: "ALL OTHER OPTIONS".to_string(),
            description: "Safe remaining changed options.".to_string(),
            changes: other,
        },
    ]
}

fn status_matches_requires_decision(status: &ShaderSettingsStatus) -> bool {
    matches!(
        status,
        ShaderSettingsStatus::Mismatch
            | ShaderSettingsStatus::DisabledLocal
            | ShaderSettingsStatus::MissingPreset
    )
}

fn read_options_ignore_set(instance_root: &Path) -> Result<BTreeSet<String>, CommandError> {
    let path = instance_root.join(".modsync-options-ignore.json");
    if !path.exists() {
        return Ok(BTreeSet::new());
    }
    let bytes = std::fs::read(path)?;
    let values = serde_json::from_slice::<Vec<String>>(&bytes).map_err(|error| {
        CommandError::Other(format!("failed to read options ignore file: {error}"))
    })?;
    Ok(values.into_iter().collect())
}

fn write_options_ignore_set(
    instance_root: &Path,
    ignored_keys: &BTreeSet<String>,
) -> Result<(), CommandError> {
    let path = instance_root.join(".modsync-options-ignore.json");
    let payload = ignored_keys.iter().cloned().collect::<Vec<_>>();
    let bytes = serde_json::to_vec_pretty(&payload)
        .map_err(|error| CommandError::Other(error.to_string()))?;
    std::fs::write(path, bytes)?;
    Ok(())
}

pub(crate) fn read_options_map(path: &Path) -> Result<BTreeMap<String, String>, CommandError> {
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let content = std::fs::read_to_string(path)?;
    let mut out = BTreeMap::new();
    for line in content.lines() {
        if let Some((key, value)) = line.split_once(':') {
            out.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    Ok(out)
}

pub(crate) fn write_options_map(
    path: &Path,
    entries: &BTreeMap<String, String>,
) -> Result<(), CommandError> {
    let mut content = String::new();
    for (key, value) in entries {
        content.push_str(key);
        content.push(':');
        content.push_str(value);
        content.push('\n');
    }
    std::fs::write(path, content)?;
    Ok(())
}

pub(crate) fn read_properties_map(path: &Path) -> Result<BTreeMap<String, String>, CommandError> {
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let content = std::fs::read_to_string(path)?;
    let mut out = BTreeMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            out.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    Ok(out)
}

pub(crate) fn write_properties_map(
    path: &Path,
    entries: &BTreeMap<String, String>,
) -> Result<(), CommandError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut content = String::new();
    for (key, value) in entries {
        content.push_str(key);
        content.push('=');
        content.push_str(value);
        content.push('\n');
    }
    std::fs::write(path, content)?;
    Ok(())
}

fn build_property_changes(
    pack_map: &BTreeMap<String, String>,
    instance_map: &BTreeMap<String, String>,
) -> Vec<ShaderSettingsChange> {
    pack_map
        .keys()
        .chain(instance_map.keys())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .filter_map(|key| {
            let pack_value = pack_map.get(&key).cloned();
            let instance_value = instance_map.get(&key).cloned();
            if pack_value == instance_value {
                return None;
            }
            Some(ShaderSettingsChange {
                key,
                action: match (&pack_value, &instance_value) {
                    (Some(_), Some(_)) => PublishAction::Update,
                    (Some(_), None) => PublishAction::Remove,
                    (None, Some(_)) => PublishAction::Add,
                    (None, None) => return None,
                },
                pack_value,
                instance_value,
            })
        })
        .collect()
}

pub(crate) fn classify_option_key(key: &str) -> OptionsSyncCategory {
    if key.starts_with("key_") {
        return OptionsSyncCategory::Keybinds;
    }
    if is_video_option_key(key) {
        return OptionsSyncCategory::Video;
    }
    OptionsSyncCategory::Other
}

fn is_video_option_key(key: &str) -> bool {
    matches!(
        key,
        "ao" | "biomeBlendRadius"
            | "bobView"
            | "cloudStatus"
            | "enableVsync"
            | "entityDistanceScaling"
            | "entityShadows"
            | "fov"
            | "fullscreen"
            | "gamma"
            | "graphicsMode"
            | "guiScale"
            | "maxFps"
            | "mipmapLevels"
            | "particles"
            | "renderDistance"
            | "resourcePacks"
            | "simulationDistance"
    )
}

fn parse_bool_property(value: Option<&String>) -> bool {
    value.is_some_and(|value| value.eq_ignore_ascii_case("true"))
}
