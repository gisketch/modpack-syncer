use std::io::Cursor;
use std::path::{Component, Path, PathBuf};
#[cfg(target_os = "macos")]
use std::process::Command;

use flate2::read::GzDecoder;
use futures::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest as _, Sha256};
use tar::Archive;
use zip::ZipArchive;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use super::{
    get_settings, save_settings, InstalledJavaRuntime, JavaInstallProgress, ManagedPrismInstall,
    PrismError, PrismInstallProgress, PrismSettings,
};
use crate::paths;

#[derive(Debug, Clone, Deserialize)]
struct AdoptiumAsset {
    binary: AdoptiumBinary,
    release_name: String,
    version: AdoptiumVersion,
}

#[derive(Debug, Clone, Deserialize)]
struct AdoptiumBinary {
    package: AdoptiumPackage,
}

#[derive(Debug, Clone, Deserialize)]
struct AdoptiumPackage {
    checksum: String,
    link: String,
    name: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AdoptiumVersion {
    major: u32,
    openjdk_version: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    assets: Vec<GitHubReleaseAsset>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubReleaseAsset {
    name: String,
    browser_download_url: String,
    digest: Option<String>,
}

pub async fn install_adoptium_java<F>(
    major: u32,
    image_type: &str,
    mut on_progress: F,
) -> Result<InstalledJavaRuntime, PrismError>
where
    F: FnMut(JavaInstallProgress) + Send,
{
    let image_type = image_type.trim().to_ascii_lowercase();
    if image_type != "jre" && image_type != "jdk" {
        return Err(PrismError::Other(anyhow::anyhow!(
            "unsupported Adoptium image type: {image_type}"
        )));
    }

    on_progress(progress_event(
        "resolving",
        3,
        None,
        None,
        Some(format!("> resolve Adoptium Java {major} {image_type}")),
    ));
    let asset = fetch_adoptium_asset(major, &image_type).await?;
    on_progress(progress_event(
        "downloading",
        8,
        Some(0),
        None,
        Some(format!("> download {}", asset.binary.package.name)),
    ));
    let bytes = download_verified_package(
        &asset.binary.package.link,
        &asset.binary.package.checksum,
        &mut on_progress,
    )
    .await?;
    on_progress(progress_event(
        "verifying",
        84,
        None,
        None,
        Some("> verify SHA-256".to_string()),
    ));
    on_progress(progress_event(
        "extracting",
        90,
        None,
        None,
        Some("> extract runtime archive".to_string()),
    ));

    let runtime =
        tokio::task::spawn_blocking(move || install_downloaded_runtime(asset, image_type, bytes))
            .await
            .map_err(|error| PrismError::Other(anyhow::Error::from(error)))??;

    on_progress(progress_event(
        "finalizing",
        97,
        None,
        None,
        Some("> locate Java binary".to_string()),
    ));
    on_progress(progress_event(
        "done",
        100,
        None,
        None,
        Some(format!("> installed :: {}", runtime.display_name)),
    ));
    Ok(runtime)
}

pub async fn install_managed_prism<F>(mut on_progress: F) -> Result<ManagedPrismInstall, PrismError>
where
    F: FnMut(PrismInstallProgress) + Send,
{
    on_progress(prism_progress_event(
        "resolving",
        3,
        None,
        None,
        Some("> resolve latest PrismLauncher-Cracked release".to_string()),
    ));
    let release = fetch_latest_prism_release().await?;
    let asset = select_managed_prism_asset(&release)?.clone();
    let expected_sha256 = release_asset_sha256(&asset)?.to_string();

    on_progress(prism_progress_event(
        "downloading",
        8,
        Some(0),
        None,
        Some(format!("> download {}", asset.name)),
    ));
    let bytes = download_prism_asset(
        &asset.browser_download_url,
        &expected_sha256,
        &mut on_progress,
    )
    .await?;
    on_progress(prism_progress_event(
        "extracting",
        90,
        None,
        None,
        Some(format!("> extract {}", asset.name)),
    ));

    let release_tag = release.tag_name.clone();
    let release_url = release.html_url.clone();
    let asset_name = asset.name.clone();
    let install = tokio::task::spawn_blocking(move || {
        install_prism_release(&release_tag, &release_url, &asset_name, bytes)
    })
    .await
    .map_err(|error| PrismError::Other(anyhow::Error::from(error)))??;

    on_progress(prism_progress_event(
        "finalizing",
        97,
        None,
        None,
        Some("> save launcher settings".to_string()),
    ));
    let existing_settings = get_settings().unwrap_or_default();
    save_settings(PrismSettings {
        binary_path: Some(install.binary_path.clone()),
        data_dir: Some(install.data_dir.clone()),
        offline_username: existing_settings.offline_username,
        offline_uuid: existing_settings.offline_uuid,
    })?;

    on_progress(prism_progress_event(
        "done",
        100,
        None,
        None,
        Some(format!("> installed :: {}", install.asset_name)),
    ));
    Ok(install)
}

pub(super) fn find_java_binary(root: &Path) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            #[cfg(target_os = "windows")]
            if name.eq_ignore_ascii_case("javaw.exe") || name.eq_ignore_ascii_case("java.exe") {
                return Some(path);
            }
            #[cfg(not(target_os = "windows"))]
            if name == "java" {
                return Some(path);
            }
        }
    }
    None
}

async fn fetch_adoptium_asset(major: u32, image_type: &str) -> Result<AdoptiumAsset, PrismError> {
    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{major}/hotspot?release_type=ga&image_type={image_type}&os={}&architecture={}",
        adoptium_os(),
        adoptium_arch(),
    );
    let assets = Client::new()
        .get(url)
        .send()
        .await
        .map_err(anyhow::Error::from)?
        .error_for_status()
        .map_err(anyhow::Error::from)?
        .json::<Vec<AdoptiumAsset>>()
        .await
        .map_err(anyhow::Error::from)?;

    assets.into_iter().next().ok_or_else(|| {
        PrismError::Other(anyhow::anyhow!(
            "no Adoptium runtime found for Java {major} {image_type}"
        ))
    })
}

async fn fetch_latest_prism_release() -> Result<GitHubRelease, PrismError> {
    Client::new()
        .get("https://api.github.com/repos/Diegiwg/PrismLauncher-Cracked/releases/latest")
        .header(reqwest::header::USER_AGENT, "modsync")
        .send()
        .await
        .map_err(anyhow::Error::from)?
        .error_for_status()
        .map_err(anyhow::Error::from)?
        .json::<GitHubRelease>()
        .await
        .map_err(anyhow::Error::from)
        .map_err(PrismError::from)
}

fn select_managed_prism_asset(release: &GitHubRelease) -> Result<&GitHubReleaseAsset, PrismError> {
    select_managed_prism_asset_for(release, std::env::consts::OS, std::env::consts::ARCH)
}

fn select_managed_prism_asset_for<'a>(
    release: &'a GitHubRelease,
    os: &str,
    arch: &str,
) -> Result<&'a GitHubReleaseAsset, PrismError> {
    let expected_names = managed_prism_asset_names_for(&release.tag_name, os, arch);
    if expected_names.is_empty() {
        return Err(PrismError::UnsupportedPlatform(
            managed_prism_target_label_for(os, arch),
        ));
    }

    expected_names
        .iter()
        .find_map(|expected_name| {
            release
                .assets
                .iter()
                .find(|asset| asset.name == *expected_name)
        })
        .ok_or_else(|| {
            PrismError::AssetNotFound(format!(
                "{} ({})",
                expected_names.join(" or "),
                managed_prism_target_label_for(os, arch)
            ))
        })
}

fn release_asset_sha256(asset: &GitHubReleaseAsset) -> Result<&str, PrismError> {
    asset
        .digest
        .as_deref()
        .and_then(|digest| digest.strip_prefix("sha256:"))
        .ok_or_else(|| PrismError::MissingDigest(asset.name.clone()))
}

async fn download_prism_asset<F>(
    url: &str,
    expected_sha256: &str,
    on_progress: &mut F,
) -> Result<Vec<u8>, PrismError>
where
    F: FnMut(PrismInstallProgress) + Send,
{
    let response = Client::new()
        .get(url)
        .header(reqwest::header::USER_AGENT, "modsync")
        .send()
        .await
        .map_err(anyhow::Error::from)?
        .error_for_status()
        .map_err(anyhow::Error::from)?;
    let total_bytes = response.content_length();
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(anyhow::Error::from)?;
        downloaded += chunk.len() as u64;
        hasher.update(&chunk);
        bytes.extend_from_slice(&chunk);

        let progress = total_bytes
            .filter(|total| *total > 0)
            .map(|total| {
                let scaled = 8u64 + downloaded.saturating_mul(72) / total;
                u8::try_from(scaled.min(80)).unwrap_or(80)
            })
            .unwrap_or(8);
        on_progress(prism_progress_event(
            "downloading",
            progress,
            Some(downloaded),
            total_bytes,
            None,
        ));
    }

    on_progress(prism_progress_event(
        "verifying",
        84,
        None,
        None,
        Some("> verify GitHub asset SHA-256".to_string()),
    ));
    let actual_sha256 = hex::encode(hasher.finalize());
    if actual_sha256 != expected_sha256 {
        return Err(PrismError::Other(anyhow::anyhow!(
            "launcher SHA-256 mismatch: expected {expected_sha256}, got {actual_sha256}"
        )));
    }

    Ok(bytes)
}

fn install_prism_release(
    release_tag: &str,
    release_url: &str,
    asset_name: &str,
    bytes: Vec<u8>,
) -> Result<ManagedPrismInstall, PrismError> {
    let install_dir = paths::managed_prism_dir()?.join(sanitize_release_segment(release_tag));
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)?;
    }
    std::fs::create_dir_all(&install_dir)?;

    #[cfg(target_os = "linux")]
    {
        let decoder = GzDecoder::new(Cursor::new(bytes));
        let mut archive = Archive::new(decoder);
        archive.unpack(&install_dir)?;

        let binary_path = install_dir.join("PrismLauncher");
        if !binary_path.is_file() {
            return Err(PrismError::Other(anyhow::anyhow!(
                "managed launcher missing executable at {}",
                binary_path.display()
            )));
        }

        Ok(ManagedPrismInstall {
            binary_path: binary_path.display().to_string(),
            data_dir: install_dir.display().to_string(),
            install_dir: install_dir.display().to_string(),
            version: release_tag.to_string(),
            asset_name: asset_name.to_string(),
            release_url: release_url.to_string(),
            offline_supported: true,
        })
    }

    #[cfg(target_os = "macos")]
    {
        install_macos_prism_release(release_tag, release_url, asset_name, bytes, &install_dir)
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = release_url;
        let _ = asset_name;
        let _ = bytes;
        let _ = install_dir;
        Err(PrismError::UnsupportedPlatform(
            managed_prism_target_label_for(std::env::consts::OS, std::env::consts::ARCH),
        ))
    }
}

fn managed_prism_target_label_for(os: &str, arch: &str) -> String {
    format!("{os}-{arch}")
}

fn managed_prism_asset_names_for(tag: &str, os: &str, arch: &str) -> Vec<String> {
    match (os, arch) {
        ("linux", "x86_64") => vec![format!("PrismLauncher-Linux-Qt6-Portable-{tag}.tar.gz")],
        ("linux", "aarch64") => vec![format!(
            "PrismLauncher-Linux-aarch64-Qt6-Portable-{tag}.tar.gz"
        )],
        ("macos", "x86_64" | "aarch64") => vec![
            format!("PrismLauncher-macOS-{tag}.dmg"),
            format!("PrismLauncher-macOS-{tag}.zip"),
        ],
        _ => Vec::new(),
    }
}

#[cfg(target_os = "macos")]
fn install_macos_prism_release(
    release_tag: &str,
    release_url: &str,
    asset_name: &str,
    bytes: Vec<u8>,
    install_dir: &Path,
) -> Result<ManagedPrismInstall, PrismError> {
    if asset_name.ends_with(".dmg") {
        install_macos_prism_dmg(release_tag, release_url, asset_name, bytes, install_dir)
    } else if asset_name.ends_with(".zip") {
        install_macos_prism_zip(release_tag, release_url, asset_name, bytes, install_dir)
    } else {
        Err(PrismError::Other(anyhow::anyhow!(
            "unsupported macOS Prism asset format: {asset_name}"
        )))
    }
}

#[cfg(target_os = "macos")]
fn install_macos_prism_dmg(
    release_tag: &str,
    release_url: &str,
    asset_name: &str,
    bytes: Vec<u8>,
    install_dir: &Path,
) -> Result<ManagedPrismInstall, PrismError> {
    let dmg_path = install_dir.join(asset_name);
    let mountpoint = install_dir.join("mount");
    std::fs::write(&dmg_path, bytes)?;
    std::fs::create_dir_all(&mountpoint)?;

    run_macos_command(
        "hdiutil",
        &[
            "attach",
            "-nobrowse",
            "-readonly",
            "-mountpoint",
            mountpoint.to_string_lossy().as_ref(),
            dmg_path.to_string_lossy().as_ref(),
        ],
    )?;

    let copy_result = (|| {
        let mounted_app = find_app_bundle(&mountpoint).ok_or_else(|| {
            PrismError::Other(anyhow::anyhow!(
                "mounted Prism DMG missing .app bundle in {}",
                mountpoint.display()
            ))
        })?;
        let app_dir = install_dir.join(
            mounted_app
                .file_name()
                .ok_or_else(|| PrismError::Other(anyhow::anyhow!("invalid .app bundle path")))?,
        );
        if app_dir.exists() {
            std::fs::remove_dir_all(&app_dir)?;
        }
        run_macos_command(
            "ditto",
            &[
                mounted_app.to_string_lossy().as_ref(),
                app_dir.to_string_lossy().as_ref(),
            ],
        )?;
        Ok(app_dir)
    })();

    let detach_result = run_macos_command(
        "hdiutil",
        &["detach", mountpoint.to_string_lossy().as_ref()],
    );
    let _ = std::fs::remove_dir_all(&mountpoint);
    let app_dir = copy_result?;
    detach_result?;

    macos_install_result(release_tag, release_url, asset_name, install_dir, &app_dir)
}

#[cfg(target_os = "macos")]
fn install_macos_prism_zip(
    release_tag: &str,
    release_url: &str,
    asset_name: &str,
    bytes: Vec<u8>,
    install_dir: &Path,
) -> Result<ManagedPrismInstall, PrismError> {
    let zip_path = install_dir.join(asset_name);
    std::fs::write(&zip_path, bytes)?;
    run_macos_command(
        "ditto",
        &[
            "-x",
            "-k",
            zip_path.to_string_lossy().as_ref(),
            install_dir.to_string_lossy().as_ref(),
        ],
    )?;
    let app_dir = find_app_bundle(install_dir).ok_or_else(|| {
        PrismError::Other(anyhow::anyhow!(
            "macOS Prism zip missing .app bundle in {}",
            install_dir.display()
        ))
    })?;
    macos_install_result(release_tag, release_url, asset_name, install_dir, &app_dir)
}

#[cfg(target_os = "macos")]
fn macos_install_result(
    release_tag: &str,
    release_url: &str,
    asset_name: &str,
    install_dir: &Path,
    app_dir: &Path,
) -> Result<ManagedPrismInstall, PrismError> {
    let binary_path = app_dir.join("Contents/MacOS/PrismLauncher");
    if !binary_path.is_file() {
        return Err(PrismError::Other(anyhow::anyhow!(
            "managed launcher missing executable at {}",
            binary_path.display()
        )));
    }

    let data_dir = install_dir.join("data");
    std::fs::create_dir_all(&data_dir)?;

    Ok(ManagedPrismInstall {
        binary_path: binary_path.display().to_string(),
        data_dir: data_dir.display().to_string(),
        install_dir: install_dir.display().to_string(),
        version: release_tag.to_string(),
        asset_name: asset_name.to_string(),
        release_url: release_url.to_string(),
        offline_supported: true,
    })
}

#[cfg(target_os = "macos")]
fn find_app_bundle(root: &Path) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if path.is_dir() && name.ends_with(".app") {
                return Some(path);
            }
            if path.is_dir() {
                stack.push(path);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn run_macos_command(program: &str, args: &[&str]) -> Result<(), PrismError> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(anyhow::Error::from)?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if stderr.is_empty() { stdout } else { stderr };
    Err(PrismError::Other(anyhow::anyhow!(
        "{program} failed: {detail}"
    )))
}

fn sanitize_release_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn prism_progress_event(
    stage: &str,
    progress: u8,
    current_bytes: Option<u64>,
    total_bytes: Option<u64>,
    log_line: Option<String>,
) -> PrismInstallProgress {
    PrismInstallProgress {
        stage: stage.to_string(),
        progress,
        current_bytes,
        total_bytes,
        log_line,
    }
}

async fn download_verified_package<F>(
    url: &str,
    expected_sha256: &str,
    on_progress: &mut F,
) -> Result<Vec<u8>, PrismError>
where
    F: FnMut(JavaInstallProgress) + Send,
{
    let response = Client::new()
        .get(url)
        .send()
        .await
        .map_err(anyhow::Error::from)?
        .error_for_status()
        .map_err(anyhow::Error::from)?;
    let total_bytes = response.content_length();
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut last_logged_bucket = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(anyhow::Error::from)?;
        downloaded += chunk.len() as u64;
        hasher.update(&chunk);
        bytes.extend_from_slice(&chunk);

        let progress = total_bytes
            .map(|total| 8 + (((downloaded as f64 / total as f64) * 72.0).round() as u8).min(72))
            .unwrap_or(40);
        on_progress(progress_event(
            "downloading",
            progress,
            Some(downloaded),
            total_bytes,
            None,
        ));

        if let Some(total) = total_bytes {
            let bucket = ((downloaded.saturating_mul(10)) / total).min(10);
            if bucket > last_logged_bucket {
                last_logged_bucket = bucket;
                on_progress(progress_event(
                    "downloading",
                    progress,
                    Some(downloaded),
                    Some(total),
                    Some(format!(
                        "> download {:>3}% :: {} / {}",
                        bucket * 10,
                        format_bytes(downloaded),
                        format_bytes(total)
                    )),
                ));
            }
        }
    }

    let got = hex::encode(hasher.finalize());
    if !got.eq_ignore_ascii_case(expected_sha256) {
        return Err(PrismError::Other(anyhow::anyhow!(
            "Adoptium package checksum mismatch: expected {expected_sha256}, got {got}"
        )));
    }

    Ok(bytes.to_vec())
}

fn progress_event(
    stage: &str,
    progress: u8,
    current_bytes: Option<u64>,
    total_bytes: Option<u64>,
    log_line: Option<String>,
) -> JavaInstallProgress {
    JavaInstallProgress {
        stage: stage.to_string(),
        progress,
        current_bytes,
        total_bytes,
        log_line,
    }
}

fn format_bytes(value: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut size = value as f64;
    let mut unit = 0usize;
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{value} {}", UNITS[unit])
    } else {
        format!("{size:.1} {}", UNITS[unit])
    }
}

fn install_downloaded_runtime(
    asset: AdoptiumAsset,
    image_type: String,
    bytes: Vec<u8>,
) -> Result<InstalledJavaRuntime, PrismError> {
    let install_dir = paths::managed_java_runtimes_dir()?.join(runtime_dir_name(
        asset.version.major,
        &image_type,
        &asset.release_name,
    ));
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)?;
    }
    std::fs::create_dir_all(&install_dir)?;

    if asset.binary.package.name.ends_with(".zip") {
        extract_zip_archive(&bytes, &install_dir)?;
    } else if asset.binary.package.name.ends_with(".tar.gz") {
        extract_tar_gz_archive(&bytes, &install_dir)?;
    } else {
        return Err(PrismError::Other(anyhow::anyhow!(
            "unsupported Adoptium package format: {}",
            asset.binary.package.name
        )));
    }

    let java_path = find_java_binary(&install_dir).ok_or_else(|| {
        PrismError::Other(anyhow::anyhow!(
            "installed Java runtime missing launcher binary in {}",
            install_dir.display()
        ))
    })?;

    Ok(InstalledJavaRuntime {
        java_path: java_path.display().to_string(),
        install_dir: install_dir.display().to_string(),
        display_name: format!(
            "Temurin {} {} ({})",
            asset.version.major,
            image_type.to_ascii_uppercase(),
            asset.version.openjdk_version,
        ),
        major: asset.version.major,
        image_type,
        release_name: asset.release_name,
    })
}

fn runtime_dir_name(major: u32, image_type: &str, release_name: &str) -> String {
    sanitize_path_segment(&format!(
        "temurin-{major}-{image_type}-{}-{}-{}",
        adoptium_os(),
        adoptium_arch(),
        release_name,
    ))
}

fn sanitize_path_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

fn extract_zip_archive(bytes: &[u8], install_dir: &Path) -> Result<(), PrismError> {
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(anyhow::Error::from)?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(anyhow::Error::from)?;
        let Some(relative_path) = entry.enclosed_name().map(|value| value.to_path_buf()) else {
            continue;
        };
        let output_path = install_dir.join(relative_path);
        if entry.is_dir() {
            std::fs::create_dir_all(&output_path)?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut output = std::fs::File::create(&output_path)?;
        std::io::copy(&mut entry, &mut output)?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            std::fs::set_permissions(&output_path, std::fs::Permissions::from_mode(mode))?;
        }
    }
    Ok(())
}

fn extract_tar_gz_archive(bytes: &[u8], install_dir: &Path) -> Result<(), PrismError> {
    let reader = Cursor::new(bytes);
    let decoder = GzDecoder::new(reader);
    let mut archive = tar::Archive::new(decoder);
    for entry in archive.entries().map_err(anyhow::Error::from)? {
        let mut entry = entry.map_err(anyhow::Error::from)?;
        let path = entry.path().map_err(anyhow::Error::from)?;
        if path.is_absolute()
            || path
                .components()
                .any(|component| matches!(component, Component::ParentDir))
        {
            return Err(PrismError::Other(anyhow::anyhow!(
                "archive contains invalid path"
            )));
        }
        entry.unpack_in(install_dir).map_err(anyhow::Error::from)?;
    }
    Ok(())
}

fn adoptium_os() -> &'static str {
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
    #[cfg(target_os = "macos")]
    {
        "mac"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
}

fn adoptium_arch() -> &'static str {
    #[cfg(target_arch = "x86_64")]
    {
        "x64"
    }
    #[cfg(target_arch = "aarch64")]
    {
        "aarch64"
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        "x64"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release_with_assets(names: &[&str]) -> GitHubRelease {
        GitHubRelease {
            tag_name: "11.0.2-1".to_string(),
            html_url: "https://example.test/release".to_string(),
            assets: names
                .iter()
                .map(|name| GitHubReleaseAsset {
                    name: (*name).to_string(),
                    browser_download_url: format!("https://example.test/{name}"),
                    digest: Some("sha256:abc".to_string()),
                })
                .collect(),
        }
    }

    #[test]
    fn macos_aarch64_matches_universal_release_assets() {
        assert_eq!(
            managed_prism_asset_names_for("11.0.2-1", "macos", "aarch64"),
            vec![
                "PrismLauncher-macOS-11.0.2-1.dmg".to_string(),
                "PrismLauncher-macOS-11.0.2-1.zip".to_string(),
            ]
        );
    }

    #[test]
    fn macos_selection_prefers_dmg_and_falls_back_to_zip() {
        let release = release_with_assets(&[
            "PrismLauncher-macOS-11.0.2-1.zip",
            "PrismLauncher-macOS-11.0.2-1.dmg",
        ]);
        let asset = select_managed_prism_asset_for(&release, "macos", "aarch64").unwrap();
        assert_eq!(asset.name, "PrismLauncher-macOS-11.0.2-1.dmg");

        let release = release_with_assets(&["PrismLauncher-macOS-11.0.2-1.zip"]);
        let asset = select_managed_prism_asset_for(&release, "macos", "x86_64").unwrap();
        assert_eq!(asset.name, "PrismLauncher-macOS-11.0.2-1.zip");
    }

    #[test]
    fn linux_assets_stay_arch_specific() {
        assert_eq!(
            managed_prism_asset_names_for("11.0.2-1", "linux", "x86_64"),
            vec!["PrismLauncher-Linux-Qt6-Portable-11.0.2-1.tar.gz".to_string()]
        );
        assert_eq!(
            managed_prism_asset_names_for("11.0.2-1", "linux", "aarch64"),
            vec!["PrismLauncher-Linux-aarch64-Qt6-Portable-11.0.2-1.tar.gz".to_string()]
        );
    }
}
