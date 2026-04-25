//! Prism Launcher integration.
//! - Detect data dir + binary.
//! - Write per-pack instance (`instance.cfg` + `mmc-pack.json` + `.minecraft/`).
//! - Spawn `prismlauncher --launch <name>`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::manifest::{Loader, Manifest};
use crate::paths;

mod install;
pub use install::{install_adoptium_java, install_managed_prism};

#[derive(Debug, thiserror::Error)]
pub enum PrismError {
    #[error("Prism Launcher not detected. Install it or set PRISM_DATA_DIR / PRISM_BIN.")]
    NotDetected,
    #[error("managed launcher install not supported on this platform yet: {0}")]
    UnsupportedPlatform(String),
    #[error("no compatible managed launcher asset found for {0}")]
    AssetNotFound(String),
    #[error("release asset missing SHA-256 digest: {0}")]
    MissingDigest(String),
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
    #[error("launch failed: {0}")]
    LaunchFailed(String),
}

#[derive(Debug, Clone, Serialize)]
pub struct PrismLocation {
    pub data_dir: String,
    pub binary: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrismSettings {
    pub binary_path: Option<String>,
    pub data_dir: Option<String>,
    pub offline_username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchProfile {
    pub min_memory_mb: u32,
    pub max_memory_mb: u32,
    pub java_path: Option<String>,
    pub extra_jvm_args: String,
    pub auto_java: bool,
}

impl Default for LaunchProfile {
    fn default() -> Self {
        Self {
            min_memory_mb: 512,
            max_memory_mb: 4096,
            java_path: None,
            extra_jvm_args: String::new(),
            auto_java: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrismAccountStatus {
    pub state: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledJavaRuntime {
    pub java_path: String,
    pub install_dir: String,
    pub display_name: String,
    pub major: u32,
    pub image_type: String,
    pub release_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallProgress {
    pub stage: String,
    pub progress: u8,
    pub current_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub log_line: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedPrismInstall {
    pub binary_path: String,
    pub data_dir: String,
    pub install_dir: String,
    pub version: String,
    pub asset_name: String,
    pub release_url: String,
    pub offline_supported: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrismInstallProgress {
    pub stage: String,
    pub progress: u8,
    pub current_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub log_line: Option<String>,
}

pub fn get_settings() -> Result<PrismSettings, PrismError> {
    let path = paths::prism_settings_path()?;
    if !path.exists() {
        return Ok(PrismSettings::default());
    }
    let bytes = std::fs::read(path)?;
    let settings = serde_json::from_slice::<PrismSettings>(&bytes).map_err(anyhow::Error::from)?;
    Ok(settings)
}

pub fn save_settings(settings: PrismSettings) -> Result<PrismSettings, PrismError> {
    let path = paths::prism_settings_path()?;
    let bytes = serde_json::to_vec_pretty(&settings).map_err(anyhow::Error::from)?;
    std::fs::write(path, bytes)?;
    Ok(settings)
}

pub fn load_launch_profile(pack_id: &str) -> Result<LaunchProfile, PrismError> {
    let path = paths::launch_profile_path(pack_id)?;
    if !path.exists() {
        return Ok(LaunchProfile::default());
    }
    let bytes = std::fs::read(path)?;
    let profile = serde_json::from_slice::<LaunchProfile>(&bytes).map_err(anyhow::Error::from)?;
    Ok(profile)
}

pub fn save_launch_profile(
    pack_id: &str,
    profile: &LaunchProfile,
) -> Result<LaunchProfile, PrismError> {
    let path = paths::launch_profile_path(pack_id)?;
    let bytes = serde_json::to_vec_pretty(profile).map_err(anyhow::Error::from)?;
    std::fs::write(path, bytes)?;
    Ok(profile.clone())
}

pub fn has_managed_java(major: u32) -> Result<bool, PrismError> {
    let prefix = format!("temurin-{major}-");
    for entry in std::fs::read_dir(paths::managed_java_runtimes_dir()?)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !path.is_dir() || !name.starts_with(&prefix) {
            continue;
        }
        if install::find_java_binary(&path).is_some() {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn clear_onboarding_settings(major: u32) -> Result<PrismSettings, PrismError> {
    let prefix = format!("temurin-{major}-");
    for entry in std::fs::read_dir(paths::managed_java_runtimes_dir()?)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if path.is_dir() && name.starts_with(&prefix) {
            std::fs::remove_dir_all(path)?;
        }
    }
    save_settings(PrismSettings::default())
}

pub fn read_account_status() -> Result<PrismAccountStatus, PrismError> {
    let Some(data_dir) = data_dir() else {
        return Ok(PrismAccountStatus {
            state: "unavailable".to_string(),
            display_name: None,
        });
    };
    let path = data_dir.join("accounts.json");
    if !path.exists() {
        return Ok(PrismAccountStatus {
            state: "logged-out".to_string(),
            display_name: None,
        });
    }
    let bytes = std::fs::read(path)?;
    let root = serde_json::from_slice::<serde_json::Value>(&bytes).map_err(anyhow::Error::from)?;
    let accounts = root
        .get("accounts")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    if let Some(active) = accounts
        .iter()
        .find(|account| account.get("active").and_then(serde_json::Value::as_bool) == Some(true))
    {
        let display_name = active
            .get("profile")
            .and_then(|profile| profile.get("name"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string);
        return Ok(PrismAccountStatus {
            state: "logged-in".to_string(),
            display_name,
        });
    }
    Ok(PrismAccountStatus {
        state: if accounts.is_empty() {
            "logged-out".to_string()
        } else {
            "available".to_string()
        },
        display_name: None,
    })
}

/// Find Prism's data directory (where `instances/` lives).
pub fn data_dir() -> Option<PathBuf> {
    if let Ok(settings) = get_settings() {
        if let Some(path) = settings
            .data_dir
            .as_deref()
            .map(PathBuf::from)
            .filter(|path| path.exists())
        {
            return Some(path);
        }
    }
    if let Ok(p) = std::env::var("PRISM_DATA_DIR") {
        let p = PathBuf::from(p);
        if p.exists() {
            return Some(p);
        }
    }
    for candidate in platform_data_candidates() {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn platform_data_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        #[cfg(target_os = "linux")]
        {
            if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
                out.push(PathBuf::from(xdg).join("PrismLauncher"));
            }
            out.push(home.join(".local/share/PrismLauncher"));
            // Flatpak
            out.push(home.join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher"));
        }
        #[cfg(target_os = "macos")]
        {
            out.push(home.join("Library/Application Support/PrismLauncher"));
        }
        #[cfg(target_os = "windows")]
        let _ = home;
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            out.push(PathBuf::from(appdata).join("PrismLauncher"));
        }
    }
    out
}

/// Find the Prism binary on PATH, flatpak exports, or via env override.
pub fn binary() -> Option<PathBuf> {
    if let Ok(settings) = get_settings() {
        if let Some(path) = settings
            .binary_path
            .as_deref()
            .map(PathBuf::from)
            .filter(|path| path.is_file())
        {
            return Some(path);
        }
    }
    if let Ok(p) = std::env::var("PRISM_BIN") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    for candidate in platform_binary_candidates() {
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    let names = ["prismlauncher", "PrismLauncher", "prismlauncher.exe"];
    // which-style PATH lookup
    if let Some(paths) = std::env::var_os("PATH") {
        for candidate in std::env::split_paths(&paths) {
            for name in &names {
                let p = candidate.join(name);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    // Flatpak (Linux) — export wrappers named by app id.
    #[cfg(target_os = "linux")]
    {
        let flatpak_name = "org.prismlauncher.PrismLauncher";
        let mut flatpak_dirs: Vec<PathBuf> = Vec::new();
        if let Some(home) = std::env::var_os("HOME") {
            flatpak_dirs.push(PathBuf::from(&home).join(".local/share/flatpak/exports/bin"));
        }
        flatpak_dirs.push(PathBuf::from("/var/lib/flatpak/exports/bin"));
        for dir in flatpak_dirs {
            let p = dir.join(flatpak_name);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn platform_binary_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    #[cfg(target_os = "linux")]
    {
        out.push(PathBuf::from("/usr/bin/prismlauncher"));
        out.push(PathBuf::from("/usr/local/bin/prismlauncher"));
    }
    #[cfg(target_os = "macos")]
    {
        out.push(PathBuf::from(
            "/Applications/Prism Launcher.app/Contents/MacOS/PrismLauncher",
        ));
        if let Some(home) = std::env::var_os("HOME") {
            out.push(
                PathBuf::from(home)
                    .join("Applications/Prism Launcher.app/Contents/MacOS/PrismLauncher"),
            );
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            out.push(
                PathBuf::from(&local_app_data).join("Programs/PrismLauncher/prismlauncher.exe"),
            );
        }
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            out.push(PathBuf::from(&program_files).join("PrismLauncher/prismlauncher.exe"));
        }
        if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
            out.push(PathBuf::from(&program_files_x86).join("PrismLauncher/prismlauncher.exe"));
        }
    }
    out
}

pub fn location() -> Option<PrismLocation> {
    let d = data_dir()?;
    let b = binary()?;
    Some(PrismLocation {
        data_dir: d.display().to_string(),
        binary: b.display().to_string(),
    })
}

/// Path to the `.minecraft/` folder for a given instance.
fn dot_minecraft(instance_dir: &Path) -> PathBuf {
    // Prism uses ".minecraft" on Linux/Windows and "minecraft" on macOS.
    #[cfg(target_os = "macos")]
    {
        instance_dir.join("minecraft")
    }
    #[cfg(not(target_os = "macos"))]
    {
        instance_dir.join(".minecraft")
    }
}

/// Resolve the `mods/` folder for a given Prism instance (best-effort; returns
/// `None` if Prism data dir cannot be located).
pub fn instance_mods_dir(instance_name: &str) -> Option<PathBuf> {
    let data = data_dir()?;
    Some(dot_minecraft(&data.join("instances").join(instance_name)).join("mods"))
}

pub fn instance_minecraft_dir(instance_name: &str) -> Option<PathBuf> {
    let data = data_dir()?;
    Some(dot_minecraft(&data.join("instances").join(instance_name)))
}

#[derive(Debug, Clone, Serialize)]
pub struct InstanceWriteReport {
    pub instance_dir: String,
    pub mods_written: usize,
    pub resourcepacks_written: usize,
    pub shaderpacks_written: usize,
    pub overrides_copied: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedModState {
    pub id: String,
    pub filename: String,
    pub sha1: String,
    pub size: u64,
}

/// Write (or update) a Prism instance for the given pack.
/// - `cached_mod_paths`: pre-downloaded content-addressable jar paths (already SHA-verified).
/// - `pack_repo_dir`: local git clone of the pack (source of configs/kubejs/overrides).
pub fn write_instance(
    instance_name: &str,
    manifest: &Manifest,
    resolved_mod_paths: &[(PathBuf, String)],
    resolved_resourcepack_paths: &[(PathBuf, String)],
    resolved_shaderpack_paths: &[(PathBuf, String)],
    pack_repo_dir: &Path,
    launch_profile: Option<&LaunchProfile>,
) -> Result<InstanceWriteReport, PrismError> {
    let data = data_dir().ok_or(PrismError::NotDetected)?;
    let instances = data.join("instances");
    std::fs::create_dir_all(&instances)?;
    let inst_dir = instances.join(instance_name);
    let dot_mc = dot_minecraft(&inst_dir);
    std::fs::create_dir_all(&dot_mc)?;

    write_instance_cfg(&inst_dir, instance_name, launch_profile)?;

    // Write mmc-pack.json
    let components = build_components(manifest);
    let mmc = serde_json::json!({
        "components": components,
        "formatVersion": 1
    });
    std::fs::write(
        inst_dir.join("mmc-pack.json"),
        serde_json::to_vec_pretty(&mmc).unwrap(),
    )?;

    // Mods
    let mods_dir = dot_mc.join("mods");
    std::fs::create_dir_all(&mods_dir)?;
    let mods_written =
        write_managed_files(&mods_dir, resolved_mod_paths, ".modsync-managed.txt", true)?;
    let state = manifest
        .mods
        .iter()
        .map(|entry| ManagedModState {
            id: entry.id.clone(),
            filename: entry.filename.clone(),
            sha1: entry.sha1.clone(),
            size: entry.size as u64,
        })
        .collect::<Vec<_>>();
    std::fs::write(
        mods_dir.join(".modsync-state.json"),
        serde_json::to_vec_pretty(&state).unwrap(),
    )?;
    let resourcepacks_dir = dot_mc.join("resourcepacks");
    std::fs::create_dir_all(&resourcepacks_dir)?;
    let resourcepacks_written = write_managed_files(
        &resourcepacks_dir,
        resolved_resourcepack_paths,
        ".modsync-managed.txt",
        false,
    )?;
    let shaderpacks_dir = dot_mc.join("shaderpacks");
    std::fs::create_dir_all(&shaderpacks_dir)?;
    let shaderpacks_written = write_managed_files(
        &shaderpacks_dir,
        resolved_shaderpack_paths,
        ".modsync-managed.txt",
        false,
    )?;

    // Overrides: copy `overrides/`, `configs/`, `kubejs/` from pack repo into `.minecraft/`.
    let mut overrides_copied = 0usize;
    for dir_name in ["overrides", "configs", "kubejs"] {
        let src = pack_repo_dir.join(dir_name);
        if !src.exists() {
            continue;
        }
        // "overrides/" contents drop directly into .minecraft; others go to
        // their namesake subdir.
        let dst = if dir_name == "overrides" {
            dot_mc.clone()
        } else if dir_name == "configs" {
            dot_mc.join("config")
        } else {
            dot_mc.join(dir_name)
        };
        overrides_copied += copy_dir_merge(&src, &dst)?;
    }

    Ok(InstanceWriteReport {
        instance_dir: inst_dir.display().to_string(),
        mods_written,
        resourcepacks_written,
        shaderpacks_written,
        overrides_copied,
    })
}

pub fn read_managed_mod_state(mods_dir: &Path) -> Result<Vec<ManagedModState>, PrismError> {
    let path = mods_dir.join(".modsync-state.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = std::fs::read(path)?;
    let state = serde_json::from_slice(&bytes).map_err(anyhow::Error::from)?;
    Ok(state)
}

pub fn apply_launch_profile(
    instance_name: &str,
    launch_profile: &LaunchProfile,
) -> Result<(), PrismError> {
    let data = data_dir().ok_or(PrismError::NotDetected)?;
    let inst_dir = data.join("instances").join(instance_name);
    std::fs::create_dir_all(&inst_dir)?;
    write_instance_cfg(&inst_dir, instance_name, Some(launch_profile))
}

fn build_components(m: &Manifest) -> Vec<serde_json::Value> {
    let mut out = vec![serde_json::json!({
        "uid": "net.minecraft",
        "version": m.pack.mc_version,
        "important": true,
    })];
    match m.pack.loader {
        Loader::NeoForge => out.push(serde_json::json!({
            "uid": "net.neoforged",
            "version": m.pack.loader_version,
        })),
        Loader::Fabric => {
            out.push(serde_json::json!({
                "uid": "net.fabricmc.fabric-loader",
                "version": m.pack.loader_version,
            }));
        }
        Loader::Forge => out.push(serde_json::json!({
            "uid": "net.minecraftforge",
            "version": m.pack.loader_version,
        })),
        Loader::Quilt => out.push(serde_json::json!({
            "uid": "org.quiltmc.quilt-loader",
            "version": m.pack.loader_version,
        })),
    }
    out
}

fn copy_or_link(src: &Path, dst: &Path) -> std::io::Result<()> {
    if dst.exists() {
        std::fs::remove_file(dst)?;
    }
    // Prefer hardlink (same filesystem). Fall back to copy.
    if std::fs::hard_link(src, dst).is_ok() {
        return Ok(());
    }
    std::fs::copy(src, dst)?;
    Ok(())
}

fn write_instance_cfg(
    inst_dir: &Path,
    instance_name: &str,
    launch_profile: Option<&LaunchProfile>,
) -> Result<(), PrismError> {
    let path = inst_dir.join("instance.cfg");
    let mut settings = if path.exists() {
        read_instance_cfg_map(&path)?
    } else {
        BTreeMap::new()
    };

    settings.insert("InstanceType".to_string(), "OneSix".to_string());
    settings.insert("name".to_string(), instance_name.to_string());
    settings.insert("iconKey".to_string(), "default".to_string());

    if let Some(profile) = launch_profile {
        apply_launch_profile_to_cfg(&mut settings, profile);
    }

    let mut output = settings
        .into_iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("\n");
    output.push('\n');
    std::fs::write(path, output)?;
    Ok(())
}

fn read_instance_cfg_map(path: &Path) -> Result<BTreeMap<String, String>, PrismError> {
    let content = std::fs::read_to_string(path)?;
    let mut map = BTreeMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('[') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            map.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    Ok(map)
}

fn apply_launch_profile_to_cfg(settings: &mut BTreeMap<String, String>, profile: &LaunchProfile) {
    let min_memory_mb = profile.min_memory_mb.min(profile.max_memory_mb);
    let max_memory_mb = profile.max_memory_mb.max(profile.min_memory_mb);
    settings.insert("OverrideMemory".to_string(), "true".to_string());
    settings.insert("MinMemAlloc".to_string(), min_memory_mb.to_string());
    settings.insert("MaxMemAlloc".to_string(), max_memory_mb.to_string());
    settings.insert("LowMemWarning".to_string(), "true".to_string());

    let jvm_args = profile.extra_jvm_args.trim();
    settings.insert(
        "OverrideJavaArgs".to_string(),
        (!jvm_args.is_empty()).to_string(),
    );
    if jvm_args.is_empty() {
        settings.remove("JvmArgs");
    } else {
        settings.insert("JvmArgs".to_string(), jvm_args.to_string());
    }

    if profile.auto_java {
        settings.insert("AutomaticJava".to_string(), "true".to_string());
        settings.insert("AutomaticJavaDownload".to_string(), "true".to_string());
        settings.insert("AutomaticJavaSwitch".to_string(), "true".to_string());
        settings.insert("OverrideJavaLocation".to_string(), "false".to_string());
        settings.remove("JavaPath");
    } else if let Some(java_path) = profile
        .java_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        settings.insert("AutomaticJava".to_string(), "false".to_string());
        settings.insert("OverrideJavaLocation".to_string(), "true".to_string());
        settings.insert("OverrideJava".to_string(), "true".to_string());
        settings.insert("JavaPath".to_string(), java_path.to_string());
    } else {
        settings.insert("AutomaticJava".to_string(), "false".to_string());
        settings.insert("OverrideJavaLocation".to_string(), "false".to_string());
        settings.remove("JavaPath");
    }
}

fn write_managed_files(
    dest_dir: &Path,
    resolved_paths: &[(PathBuf, String)],
    sidecar_name: &str,
    strict_sync: bool,
) -> std::io::Result<usize> {
    use std::collections::HashSet;

    let sidecar = dest_dir.join(sidecar_name);
    if let Ok(prev) = std::fs::read_to_string(&sidecar) {
        for line in prev.lines() {
            let p = dest_dir.join(line);
            if p.exists() {
                let _ = std::fs::remove_file(p);
            }
        }
    }

    if strict_sync {
        let desired = resolved_paths
            .iter()
            .map(|(_, filename)| filename.as_str())
            .collect::<HashSet<_>>();
        for entry in std::fs::read_dir(dest_dir)? {
            let entry = entry?;
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !path.is_file() || name.starts_with('.') || desired.contains(name) {
                continue;
            }
            let _ = std::fs::remove_file(path);
        }
    }

    let mut written = 0usize;
    let mut sidecar_lines = Vec::new();
    for (src, filename) in resolved_paths {
        let dst = dest_dir.join(filename);
        copy_or_link(src, &dst)?;
        sidecar_lines.push(filename.clone());
        written += 1;
    }
    std::fs::write(sidecar, sidecar_lines.join("\n"))?;
    Ok(written)
}

fn copy_dir_merge(src: &Path, dst: &Path) -> std::io::Result<usize> {
    std::fs::create_dir_all(dst)?;
    let mut count = 0;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            count += copy_dir_merge(&path, &target)?;
        } else {
            std::fs::copy(&path, &target)?;
            count += 1;
        }
    }
    Ok(count)
}

pub fn launch(instance_name: &str) -> Result<(), PrismError> {
    let bin = binary().ok_or(PrismError::NotDetected)?;
    let settings = get_settings().unwrap_or_default();
    let mut command = Command::new(&bin);

    if let Some(data_dir) = settings
        .data_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.arg("--dir").arg(data_dir);
    }

    command.arg("--launch").arg(instance_name);

    if let Some(offline_username) = settings
        .offline_username
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        ensure_offline_account(offline_username)?;
        command.arg("--offline").arg(offline_username);
    }

    let status = command
        .spawn()
        .map_err(|e| PrismError::LaunchFailed(e.to_string()))?;
    // We don't wait — Prism spawns its own UI/process.
    drop(status);
    Ok(())
}

fn ensure_offline_account(username: &str) -> Result<(), PrismError> {
    let Some(data_dir) = data_dir() else {
        return Ok(());
    };
    std::fs::create_dir_all(&data_dir)?;
    let accounts_path = data_dir.join("accounts.json");
    let desired_profile_id = offline_profile_id(username);
    let mut root = if accounts_path.exists() {
        let bytes = std::fs::read(&accounts_path)?;
        serde_json::from_slice::<serde_json::Value>(&bytes).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    if !root.is_object() {
        root = json!({});
    }

    let root_object = root
        .as_object_mut()
        .ok_or_else(|| PrismError::Other(anyhow::anyhow!("accounts root must be an object")))?;
    root_object.insert("formatVersion".to_string(), json!(3));

    let accounts_value = root_object
        .entry("accounts".to_string())
        .or_insert_with(|| json!([]));
    if !accounts_value.is_array() {
        *accounts_value = json!([]);
    }

    let accounts = accounts_value
        .as_array_mut()
        .ok_or_else(|| PrismError::Other(anyhow::anyhow!("accounts must be an array")))?;
    let mut next_accounts = Vec::with_capacity(accounts.len() + 1);
    for account in accounts.iter() {
        if offline_account_matches(account, username, &desired_profile_id) {
            continue;
        }

        let mut cloned = account.clone();
        if let Some(object) = cloned.as_object_mut() {
            object.insert("active".to_string(), json!(false));
        }
        next_accounts.push(cloned);
    }
    next_accounts.push(build_offline_account(username, &desired_profile_id));
    *accounts = next_accounts;

    let bytes = serde_json::to_vec_pretty(&root).map_err(anyhow::Error::from)?;
    std::fs::write(accounts_path, bytes)?;
    Ok(())
}

fn offline_profile_id(username: &str) -> String {
    Uuid::new_v3(
        &Uuid::NAMESPACE_OID,
        format!("OfflinePlayer:{username}").as_bytes(),
    )
    .simple()
    .to_string()
}

fn offline_account_matches(
    account: &serde_json::Value,
    username: &str,
    desired_profile_id: &str,
) -> bool {
    account.get("type").and_then(serde_json::Value::as_str) == Some("Offline")
        && (account
            .get("profile")
            .and_then(|profile| profile.get("name"))
            .and_then(serde_json::Value::as_str)
            == Some(username)
            || account
                .get("profile")
                .and_then(|profile| profile.get("id"))
                .and_then(serde_json::Value::as_str)
                == Some(desired_profile_id)
            || account
                .get("ygg")
                .and_then(|token| token.get("extra"))
                .and_then(|extra| extra.get("userName"))
                .and_then(serde_json::Value::as_str)
                == Some(username))
}

fn build_offline_account(username: &str, profile_id: &str) -> serde_json::Value {
    json!({
        "active": true,
        "type": "Offline",
        "ygg": {
            "token": "0",
            "iat": chrono::Utc::now().timestamp(),
            "extra": {
                "userName": username,
                "clientToken": Uuid::new_v4().simple().to_string(),
            }
        },
        "profile": {
            "id": profile_id,
            "name": username,
            "skin": {
                "id": "",
                "url": "",
                "variant": ""
            },
            "capes": []
        }
    })
}
