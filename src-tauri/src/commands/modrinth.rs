use serde::{Deserialize, Serialize};

use super::{CommandError, ManifestArtifactCategory};
use crate::{download, manifest, paths, prism};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthAddPreview {
    pub project_id: String,
    pub version_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub version_number: String,
    pub filename: String,
    pub size: u64,
    pub url: String,
    pub sha1: String,
    pub sha512: Option<String>,
    pub suggested_side: manifest::Side,
    pub already_tracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UnpublishedModrinthState {
    pub(super) filename: String,
    pub(super) project_id: String,
    pub(super) version_id: String,
    pub(super) slug: String,
    pub(super) url: String,
    pub(super) sha1: String,
    pub(super) sha512: Option<String>,
    pub(super) size: u64,
    pub(super) side: manifest::Side,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthProjectApi {
    id: String,
    slug: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    icon_url: Option<String>,
    client_side: String,
    server_side: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthVersionApi {
    id: String,
    version_number: String,
    files: Vec<ModrinthVersionFileApi>,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthVersionFileApi {
    url: String,
    filename: String,
    size: u64,
    #[serde(default)]
    primary: bool,
    hashes: ModrinthHashesApi,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthHashesApi {
    sha1: String,
    #[serde(default)]
    sha512: Option<String>,
}

#[tauri::command]
pub async fn preview_modrinth_mod(
    pack_id: String,
    identifier: String,
    category: Option<ManifestArtifactCategory>,
) -> Result<ModrinthAddPreview, CommandError> {
    let category = category.unwrap_or(ManifestArtifactCategory::Mods);
    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    resolve_modrinth_preview(&manifest, &identifier, category).await
}

#[tauri::command]
pub async fn add_modrinth_mod(
    pack_id: String,
    category: Option<ManifestArtifactCategory>,
    project_id: String,
    version_id: String,
    side: Option<String>,
) -> Result<manifest::Entry, CommandError> {
    let category = category.unwrap_or(ManifestArtifactCategory::Mods);
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    let manifest = tokio::task::spawn_blocking({
        let manifest_path = manifest_path.clone();
        move || manifest::load_from_path(&manifest_path)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))??;

    let preview =
        resolve_modrinth_preview_from_ids(&manifest, &project_id, &version_id, category).await?;
    let chosen_side = side
        .as_deref()
        .map(parse_manifest_side)
        .transpose()?
        .unwrap_or(preview.suggested_side);

    let next_entry = manifest::Entry {
        id: preview.slug.clone(),
        source: manifest::Source::Modrinth,
        project_id: Some(preview.project_id.clone()),
        version_id: Some(preview.version_id.clone()),
        repo_path: None,
        filename: preview.filename.clone(),
        sha1: preview.sha1.clone(),
        sha512: preview.sha512.clone(),
        size: preview.size,
        url: preview.url.clone(),
        optional: false,
        side: chosen_side,
    };
    let cached_path = download::fetch_entry(&next_entry).await?;
    let instance_name = format!("modsync-{pack_id}");
    let artifact_dir = instance_artifact_dir(&instance_name, category)?;

    tokio::task::spawn_blocking(move || -> Result<manifest::Entry, CommandError> {
        std::fs::create_dir_all(&artifact_dir)?;
        copy_local_file(&cached_path, &artifact_dir.join(&next_entry.filename))?;

        let mut state = read_unpublished_modrinth_state(&artifact_dir)?;
        state.retain(|entry| entry.filename != next_entry.filename);
        state.push(UnpublishedModrinthState {
            filename: next_entry.filename.clone(),
            project_id: preview.project_id,
            version_id: preview.version_id,
            slug: preview.slug,
            url: next_entry.url.clone(),
            sha1: next_entry.sha1.clone(),
            sha512: next_entry.sha512.clone(),
            size: next_entry.size,
            side: next_entry.side,
        });
        state.sort_by(|left, right| left.filename.cmp(&right.filename));
        write_unpublished_modrinth_state(&artifact_dir, &state)?;
        Ok(next_entry)
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn delete_instance_mod(
    pack_id: String,
    filename: String,
    category: Option<ManifestArtifactCategory>,
    instance_name: Option<String>,
) -> Result<(), CommandError> {
    let instance_name = instance_name.unwrap_or_else(|| format!("modsync-{pack_id}"));
    let mods_dir = instance_artifact_dir(
        &instance_name,
        category.unwrap_or(ManifestArtifactCategory::Mods),
    )?;
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        let path = mods_dir.join(&filename);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        let mut state = read_unpublished_modrinth_state(&mods_dir)?;
        state.retain(|entry| entry.filename != filename);
        write_unpublished_modrinth_state(&mods_dir, &state)?;
        Ok(())
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

pub(super) fn read_unpublished_modrinth_state(
    mods_dir: &std::path::Path,
) -> Result<Vec<UnpublishedModrinthState>, CommandError> {
    let path = mods_dir.join(".modsync-unpublished-modrinth.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = std::fs::read(path)?;
    serde_json::from_slice(&bytes).map_err(|error| CommandError::Other(error.to_string()))
}

fn write_unpublished_modrinth_state(
    mods_dir: &std::path::Path,
    state: &[UnpublishedModrinthState],
) -> Result<(), CommandError> {
    let path = mods_dir.join(".modsync-unpublished-modrinth.json");
    let bytes = serde_json::to_vec_pretty(state).map_err(anyhow::Error::from)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

fn instance_artifact_dir(
    instance_name: &str,
    category: ManifestArtifactCategory,
) -> Result<std::path::PathBuf, CommandError> {
    let instance_root = prism::instance_minecraft_dir(instance_name)
        .ok_or_else(|| CommandError::Prism("Prism instance not found".to_string()))?;
    Ok(match category {
        ManifestArtifactCategory::Mods => instance_root.join("mods"),
        ManifestArtifactCategory::Resourcepacks => instance_root.join("resourcepacks"),
        ManifestArtifactCategory::Shaderpacks => instance_root.join("shaderpacks"),
    })
}

fn copy_local_file(src: &std::path::Path, dst: &std::path::Path) -> Result<(), CommandError> {
    if dst.exists() {
        std::fs::remove_file(dst)?;
    }
    if std::fs::hard_link(src, dst).is_ok() {
        return Ok(());
    }
    std::fs::copy(src, dst)?;
    Ok(())
}

async fn resolve_modrinth_preview(
    manifest: &manifest::Manifest,
    identifier: &str,
    category: ManifestArtifactCategory,
) -> Result<ModrinthAddPreview, CommandError> {
    let project_id = normalize_modrinth_identifier(identifier)?;
    let project = fetch_modrinth_project(&project_id).await?;
    let version = fetch_latest_modrinth_version(
        &project.id,
        &manifest.pack.mc_version,
        manifest.pack.loader,
        category,
    )
    .await?;
    build_modrinth_preview(manifest, project, version, category)
}

async fn resolve_modrinth_preview_from_ids(
    manifest: &manifest::Manifest,
    project_id: &str,
    version_id: &str,
    category: ManifestArtifactCategory,
) -> Result<ModrinthAddPreview, CommandError> {
    let project = fetch_modrinth_project(project_id).await?;
    let version = fetch_modrinth_version(version_id).await?;
    build_modrinth_preview(manifest, project, version, category)
}

fn build_modrinth_preview(
    manifest: &manifest::Manifest,
    project: ModrinthProjectApi,
    version: ModrinthVersionApi,
    category: ManifestArtifactCategory,
) -> Result<ModrinthAddPreview, CommandError> {
    let file = version
        .files
        .iter()
        .find(|file| file.primary)
        .cloned()
        .or_else(|| version.files.first().cloned())
        .ok_or_else(|| {
            CommandError::Other("Modrinth version has no downloadable files".to_string())
        })?;
    let suggested_side = suggested_manifest_side(&project.client_side, &project.server_side);
    let already_tracked = manifest_entries_for_category(manifest, category)
        .iter()
        .any(|entry| {
            entry.project_id.as_deref() == Some(project.id.as_str())
                || entry.id == project.slug
                || entry.filename == file.filename
        });

    Ok(ModrinthAddPreview {
        project_id: project.id,
        version_id: version.id,
        slug: project.slug,
        title: project.title,
        description: project.description.unwrap_or_default(),
        icon_url: project.icon_url,
        version_number: version.version_number,
        filename: file.filename,
        size: file.size,
        url: file.url,
        sha1: file.hashes.sha1,
        sha512: file.hashes.sha512,
        suggested_side,
        already_tracked,
    })
}

async fn fetch_modrinth_project(project_id: &str) -> Result<ModrinthProjectApi, CommandError> {
    reqwest::Client::new()
        .get(format!("https://api.modrinth.com/v2/project/{project_id}"))
        .header(
            reqwest::header::USER_AGENT,
            "modsync/0.1 (https://github.com/gisketch/modsync)",
        )
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<ModrinthProjectApi>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))
}

async fn fetch_latest_modrinth_version(
    project_id: &str,
    mc_version: &str,
    loader: manifest::Loader,
    category: ManifestArtifactCategory,
) -> Result<ModrinthVersionApi, CommandError> {
    let mut query = vec![("game_versions", format!("[\"{mc_version}\"]"))];
    if category == ManifestArtifactCategory::Mods {
        query.push(("loaders", format!("[\"{}\"]", modrinth_loader(loader))));
    }

    let versions = reqwest::Client::new()
        .get(format!(
            "https://api.modrinth.com/v2/project/{project_id}/version"
        ))
        .header(
            reqwest::header::USER_AGENT,
            "modsync/0.1 (https://github.com/gisketch/modsync)",
        )
        .query(&query)
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<Vec<ModrinthVersionApi>>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?;
    versions.into_iter().next().ok_or_else(|| {
        CommandError::Other("No compatible Modrinth version found for this pack".to_string())
    })
}

fn manifest_entries_for_category(
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
) -> &[manifest::Entry] {
    match category {
        ManifestArtifactCategory::Mods => &manifest.mods,
        ManifestArtifactCategory::Resourcepacks => &manifest.resourcepacks,
        ManifestArtifactCategory::Shaderpacks => &manifest.shaderpacks,
    }
}

async fn fetch_modrinth_version(version_id: &str) -> Result<ModrinthVersionApi, CommandError> {
    reqwest::Client::new()
        .get(format!("https://api.modrinth.com/v2/version/{version_id}"))
        .header(
            reqwest::header::USER_AGENT,
            "modsync/0.1 (https://github.com/gisketch/modsync)",
        )
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<ModrinthVersionApi>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))
}

fn normalize_modrinth_identifier(input: &str) -> Result<String, CommandError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(CommandError::Other(
            "Enter Modrinth link, slug, or project id".to_string(),
        ));
    }
    if !trimmed.contains("://") {
        return Ok(trimmed.trim_matches('/').to_string());
    }
    let url = url::Url::parse(trimmed).map_err(|error| CommandError::Other(error.to_string()))?;
    if url.host_str() != Some("modrinth.com") && url.host_str() != Some("www.modrinth.com") {
        return Err(CommandError::Other(
            "Only Modrinth links supported for this flow".to_string(),
        ));
    }
    let segments = url
        .path_segments()
        .map(|segments| {
            segments
                .filter(|segment| !segment.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if segments.len() < 2 {
        return Err(CommandError::Other(
            "Could not parse Modrinth project from link".to_string(),
        ));
    }
    Ok(segments[1].to_string())
}

fn modrinth_loader(loader: manifest::Loader) -> &'static str {
    match loader {
        manifest::Loader::NeoForge => "neoforge",
        manifest::Loader::Fabric => "fabric",
        manifest::Loader::Forge => "forge",
        manifest::Loader::Quilt => "quilt",
    }
}

fn suggested_manifest_side(client_side: &str, server_side: &str) -> manifest::Side {
    let client_supported = client_side != "unsupported";
    let server_supported = server_side != "unsupported";
    match (client_supported, server_supported) {
        (true, true) => manifest::Side::Both,
        (true, false) => manifest::Side::Client,
        (false, true) => manifest::Side::Server,
        (false, false) => manifest::Side::Client,
    }
}

fn parse_manifest_side(value: &str) -> Result<manifest::Side, CommandError> {
    match value {
        "client" => Ok(manifest::Side::Client),
        "server" => Ok(manifest::Side::Server),
        "both" => Ok(manifest::Side::Both),
        _ => Err(CommandError::Other(format!("Unsupported side: {value}"))),
    }
}
