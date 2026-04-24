//! Prism Launcher integration.
//! - Detect data dir + binary.
//! - Write per-pack instance (`instance.cfg` + `mmc-pack.json` + `.minecraft/`).
//! - Spawn `prismlauncher --launch <name>`.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::manifest::{Loader, Manifest};

#[derive(Debug, thiserror::Error)]
pub enum PrismError {
    #[error("Prism Launcher not detected. Install it or set PRISM_DATA_DIR / PRISM_BIN.")]
    NotDetected,
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

/// Find Prism's data directory (where `instances/` lives).
pub fn data_dir() -> Option<PathBuf> {
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
    if let Ok(p) = std::env::var("PRISM_BIN") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
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
) -> Result<InstanceWriteReport, PrismError> {
    let data = data_dir().ok_or(PrismError::NotDetected)?;
    let instances = data.join("instances");
    std::fs::create_dir_all(&instances)?;
    let inst_dir = instances.join(instance_name);
    let dot_mc = dot_minecraft(&inst_dir);
    std::fs::create_dir_all(&dot_mc)?;

    // Write instance.cfg (minimal)
    let cfg = format!(
        "InstanceType=OneSix\nname={name}\niconKey=default\n",
        name = instance_name
    );
    std::fs::write(inst_dir.join("instance.cfg"), cfg)?;

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
    let mods_written = write_managed_files(&mods_dir, resolved_mod_paths, ".modsync-managed.txt")?;
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
    )?;
    let shaderpacks_dir = dot_mc.join("shaderpacks");
    std::fs::create_dir_all(&shaderpacks_dir)?;
    let shaderpacks_written = write_managed_files(
        &shaderpacks_dir,
        resolved_shaderpack_paths,
        ".modsync-managed.txt",
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

fn write_managed_files(
    dest_dir: &Path,
    resolved_paths: &[(PathBuf, String)],
    sidecar_name: &str,
) -> std::io::Result<usize> {
    let sidecar = dest_dir.join(sidecar_name);
    if let Ok(prev) = std::fs::read_to_string(&sidecar) {
        for line in prev.lines() {
            let p = dest_dir.join(line);
            if p.exists() {
                let _ = std::fs::remove_file(p);
            }
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
    let status = Command::new(&bin)
        .arg("--launch")
        .arg(instance_name)
        .spawn()
        .map_err(|e| PrismError::LaunchFailed(e.to_string()))?;
    // We don't wait — Prism spawns its own UI/process.
    drop(status);
    Ok(())
}
