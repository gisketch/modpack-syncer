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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthSearchReport {
    pub hits: Vec<ModrinthSearchHit>,
    pub offset: u32,
    pub limit: u32,
    pub total_hits: u32,
    pub mc_version: String,
    pub loader: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthSearchHit {
    pub project_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub follows: u64,
    pub date_modified: Option<String>,
    pub categories: Vec<String>,
    pub versions: Vec<String>,
    pub suggested_side: manifest::Side,
    pub already_tracked: bool,
    pub tracked_version_id: Option<String>,
    pub tracked_side: Option<manifest::Side>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthVersionSummary {
    pub id: String,
    pub version_number: String,
    pub filename: String,
    pub size: u64,
    pub date_published: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthDependencySummary {
    pub project_id: String,
    pub version_id: String,
    pub slug: String,
    pub title: String,
    pub icon_url: Option<String>,
    pub version_number: String,
    pub filename: String,
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
struct ModrinthSearchResponseApi {
    hits: Vec<ModrinthSearchHitApi>,
    offset: u32,
    limit: u32,
    total_hits: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthSearchHitApi {
    project_id: String,
    slug: String,
    title: String,
    description: String,
    author: String,
    #[serde(default)]
    icon_url: Option<String>,
    downloads: u64,
    follows: u64,
    #[serde(default)]
    date_modified: Option<String>,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    versions: Vec<String>,
    client_side: String,
    server_side: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthVersionApi {
    id: String,
    project_id: String,
    version_number: String,
    #[serde(default)]
    dependencies: Vec<ModrinthDependencyApi>,
    files: Vec<ModrinthVersionFileApi>,
    #[serde(default)]
    date_published: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ModrinthDependencyApi {
    #[serde(default)]
    project_id: Option<String>,
    #[serde(default)]
    version_id: Option<String>,
    dependency_type: String,
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
pub async fn search_modrinth_projects(
    pack_id: String,
    category: ManifestArtifactCategory,
    query: Option<String>,
    page: Option<u32>,
    side: Option<String>,
    sort: Option<String>,
) -> Result<ModrinthSearchReport, CommandError> {
    const LIMIT: u32 = 20;

    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    let page = page.unwrap_or(1).max(1);
    let offset = (page - 1) * LIMIT;
    let search = fetch_modrinth_search(
        &manifest,
        category,
        query.unwrap_or_default().trim(),
        offset,
        LIMIT,
        side.as_deref().unwrap_or("all"),
        sort.as_deref().unwrap_or("relevance"),
    )
    .await?;
    let entries = manifest_entries_for_category(&manifest, category);
    let unpublished_state = read_unpublished_state_for_pack(&pack_id, category).await;
    let hits = search
        .hits
        .into_iter()
        .map(|hit| {
            let tracked = entries.iter().find(|entry| {
                entry.project_id.as_deref() == Some(hit.project_id.as_str()) || entry.id == hit.slug
            });
            let staged = unpublished_state
                .iter()
                .find(|entry| entry.project_id == hit.project_id || entry.slug == hit.slug);
            ModrinthSearchHit {
                project_id: hit.project_id,
                slug: hit.slug,
                title: hit.title,
                description: hit.description,
                author: hit.author,
                icon_url: hit.icon_url,
                downloads: hit.downloads,
                follows: hit.follows,
                date_modified: hit.date_modified,
                categories: hit.categories,
                versions: hit.versions,
                suggested_side: suggested_manifest_side(&hit.client_side, &hit.server_side),
                already_tracked: tracked.is_some() || staged.is_some(),
                tracked_version_id: tracked
                    .and_then(|entry| entry.version_id.clone())
                    .or_else(|| staged.map(|entry| entry.version_id.clone())),
                tracked_side: tracked
                    .map(|entry| entry.side)
                    .or_else(|| staged.map(|entry| entry.side)),
            }
        })
        .collect();

    Ok(ModrinthSearchReport {
        hits,
        offset: search.offset,
        limit: search.limit,
        total_hits: search.total_hits,
        mc_version: manifest.pack.mc_version,
        loader: modrinth_loader(manifest.pack.loader).to_string(),
    })
}

#[tauri::command]
pub async fn list_modrinth_project_versions(
    pack_id: String,
    category: ManifestArtifactCategory,
    project_id: String,
) -> Result<Vec<ModrinthVersionSummary>, CommandError> {
    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    let versions = fetch_modrinth_versions(
        &project_id,
        &manifest.pack.mc_version,
        manifest.pack.loader,
        category,
    )
    .await?;
    Ok(versions
        .into_iter()
        .filter_map(|version| {
            let file = primary_version_file(&version)?;
            Some(ModrinthVersionSummary {
                id: version.id,
                version_number: version.version_number,
                filename: file.filename,
                size: file.size,
                date_published: version.date_published,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn list_modrinth_version_dependencies(
    pack_id: String,
    category: ManifestArtifactCategory,
    version_id: String,
) -> Result<Vec<ModrinthDependencySummary>, CommandError> {
    let manifest_path = paths::packs_dir()?.join(&pack_id).join("manifest.json");
    let manifest = tokio::task::spawn_blocking(move || manifest::load_from_path(&manifest_path))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))??;
    resolve_modrinth_dependencies(&pack_id, &manifest, category, &version_id).await
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
    install_dependencies: Option<bool>,
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

    let next_entry = install_modrinth_version(
        &pack_id,
        &manifest,
        category,
        &project_id,
        &version_id,
        side.as_deref(),
    )
    .await?;
    if category == ManifestArtifactCategory::Mods && install_dependencies.unwrap_or(false) {
        let dependencies =
            resolve_modrinth_dependencies(&pack_id, &manifest, category, &version_id).await?;
        for dependency in dependencies
            .into_iter()
            .filter(|dependency| !dependency.already_tracked)
        {
            install_modrinth_version(
                &pack_id,
                &manifest,
                ManifestArtifactCategory::Mods,
                &dependency.project_id,
                &dependency.version_id,
                None,
            )
            .await?;
        }
    }
    Ok(next_entry)
}

async fn install_modrinth_version(
    pack_id: &str,
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
    project_id: &str,
    version_id: &str,
    side: Option<&str>,
) -> Result<manifest::Entry, CommandError> {
    let preview =
        resolve_modrinth_preview_from_ids(manifest, project_id, version_id, category).await?;
    let chosen_side = side
        .map(parse_manifest_side)
        .transpose()?
        .unwrap_or(preview.suggested_side);
    let previous_manifest_filename = manifest_entries_for_category(&manifest, category)
        .iter()
        .find(|entry| {
            entry.project_id.as_deref() == Some(preview.project_id.as_str())
                || entry.id == preview.slug
        })
        .map(|entry| entry.filename.clone());

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
    let preview_project_id = preview.project_id.clone();
    let preview_slug = preview.slug.clone();

    tokio::task::spawn_blocking(move || -> Result<manifest::Entry, CommandError> {
        std::fs::create_dir_all(&artifact_dir)?;
        let mut state = read_unpublished_modrinth_state(&artifact_dir)?;
        let previous_filename = previous_manifest_filename.or_else(|| {
            state
                .iter()
                .find(|entry| entry.project_id == preview_project_id || entry.slug == preview_slug)
                .map(|entry| entry.filename.clone())
        });
        if let Some(previous_filename) = previous_filename.as_ref() {
            if previous_filename != &next_entry.filename {
                remove_file_if_exists(&artifact_dir.join(previous_filename))?;
                remove_file_if_exists(&artifact_dir.join(format!("{previous_filename}.disabled")))?;
            }
        }
        copy_local_file(&cached_path, &artifact_dir.join(&next_entry.filename))?;

        if let Some(previous_filename) = previous_filename.as_ref() {
            state.retain(|entry| entry.filename != *previous_filename);
        }
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

fn remove_file_if_exists(path: &std::path::Path) -> Result<(), CommandError> {
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

async fn read_unpublished_state_for_pack(
    pack_id: &str,
    category: ManifestArtifactCategory,
) -> Vec<UnpublishedModrinthState> {
    let instance_name = format!("modsync-{pack_id}");
    let Ok(artifact_dir) = instance_artifact_dir(&instance_name, category) else {
        return Vec::new();
    };
    tokio::task::spawn_blocking(move || read_unpublished_modrinth_state(&artifact_dir))
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default()
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

async fn resolve_modrinth_dependencies(
    pack_id: &str,
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
    version_id: &str,
) -> Result<Vec<ModrinthDependencySummary>, CommandError> {
    if category != ManifestArtifactCategory::Mods {
        return Ok(Vec::new());
    }

    let selected_version = fetch_modrinth_version(version_id).await?;
    let unpublished_state =
        read_unpublished_state_for_pack(pack_id, ManifestArtifactCategory::Mods).await;
    let mut out = Vec::new();
    for dependency in selected_version
        .dependencies
        .into_iter()
        .filter(|dependency| dependency.dependency_type == "required")
    {
        let dependency_version = match dependency.version_id.as_deref() {
            Some(version_id) => fetch_modrinth_version(version_id).await?,
            None => {
                let project_id = dependency.project_id.as_deref().ok_or_else(|| {
                    CommandError::Other("Modrinth dependency missing project id".to_string())
                })?;
                fetch_latest_modrinth_version(
                    project_id,
                    &manifest.pack.mc_version,
                    manifest.pack.loader,
                    ManifestArtifactCategory::Mods,
                )
                .await?
            }
        };
        let project_id = dependency
            .project_id
            .unwrap_or_else(|| dependency_version.project_id.clone());
        let project = fetch_modrinth_project(&project_id).await?;
        let Some(file) = primary_version_file(&dependency_version) else {
            continue;
        };
        let already_tracked = is_modrinth_project_tracked(
            manifest,
            ManifestArtifactCategory::Mods,
            &unpublished_state,
            &project.id,
            &project.slug,
            Some(&file.filename),
        );
        out.push(ModrinthDependencySummary {
            project_id: project.id,
            version_id: dependency_version.id,
            slug: project.slug,
            title: project.title,
            icon_url: project.icon_url,
            version_number: dependency_version.version_number,
            filename: file.filename,
            already_tracked,
        });
    }
    out.sort_by(|left, right| left.title.cmp(&right.title));
    out.dedup_by(|left, right| left.project_id == right.project_id);
    Ok(out)
}

fn is_modrinth_project_tracked(
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
    unpublished_state: &[UnpublishedModrinthState],
    project_id: &str,
    slug: &str,
    filename: Option<&str>,
) -> bool {
    manifest_entries_for_category(manifest, category)
        .iter()
        .any(|entry| {
            entry.project_id.as_deref() == Some(project_id)
                || entry.id == slug
                || filename.is_some_and(|filename| entry.filename == filename)
        })
        || unpublished_state.iter().any(|entry| {
            entry.project_id == project_id
                || entry.slug == slug
                || filename.is_some_and(|filename| entry.filename == filename)
        })
}

fn primary_version_file(version: &ModrinthVersionApi) -> Option<ModrinthVersionFileApi> {
    version
        .files
        .iter()
        .find(|file| file.primary)
        .cloned()
        .or_else(|| version.files.first().cloned())
}

async fn fetch_modrinth_search(
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
    query: &str,
    offset: u32,
    limit: u32,
    side: &str,
    sort: &str,
) -> Result<ModrinthSearchResponseApi, CommandError> {
    let facets = modrinth_search_facets(manifest, category, side);
    let facets = serde_json::to_string(&facets).map_err(anyhow::Error::from)?;
    let sort = match sort {
        "downloads" | "follows" | "newest" | "updated" => sort,
        _ => "relevance",
    };
    reqwest::Client::new()
        .get("https://api.modrinth.com/v2/search")
        .header(
            reqwest::header::USER_AGENT,
            "modsync/0.1 (https://github.com/gisketch/modsync)",
        )
        .query(&[
            ("query", query.to_string()),
            ("facets", facets),
            ("offset", offset.to_string()),
            ("limit", limit.to_string()),
            ("index", sort.to_string()),
        ])
        .send()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))?
        .error_for_status()
        .map_err(|error| CommandError::Other(error.to_string()))?
        .json::<ModrinthSearchResponseApi>()
        .await
        .map_err(|error| CommandError::Other(error.to_string()))
}

fn modrinth_search_facets(
    manifest: &manifest::Manifest,
    category: ManifestArtifactCategory,
    side: &str,
) -> Vec<Vec<String>> {
    let mut facets = vec![
        vec![format!("project_type:{}", modrinth_project_type(category))],
        vec![format!("versions:{}", manifest.pack.mc_version)],
    ];
    if category == ManifestArtifactCategory::Mods {
        facets.push(vec![format!(
            "categories:{}",
            modrinth_loader(manifest.pack.loader)
        )]);
    }
    match side {
        "client" => facets.push(vec!["client_side!=unsupported".to_string()]),
        "server" => facets.push(vec!["server_side!=unsupported".to_string()]),
        "both" => {
            facets.push(vec!["client_side!=unsupported".to_string()]);
            facets.push(vec!["server_side!=unsupported".to_string()]);
        }
        _ => {}
    }
    facets
}

fn modrinth_project_type(category: ManifestArtifactCategory) -> &'static str {
    match category {
        ManifestArtifactCategory::Mods => "mod",
        ManifestArtifactCategory::Resourcepacks => "resourcepack",
        ManifestArtifactCategory::Shaderpacks => "shader",
    }
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
    let versions = fetch_modrinth_versions(project_id, mc_version, loader, category).await?;
    versions.into_iter().next().ok_or_else(|| {
        CommandError::Other("No compatible Modrinth version found for this pack".to_string())
    })
}

async fn fetch_modrinth_versions(
    project_id: &str,
    mc_version: &str,
    loader: manifest::Loader,
    category: ManifestArtifactCategory,
) -> Result<Vec<ModrinthVersionApi>, CommandError> {
    let mut query = vec![("game_versions", format!("[\"{mc_version}\"]"))];
    if category == ManifestArtifactCategory::Mods {
        query.push(("loaders", format!("[\"{}\"]", modrinth_loader(loader))));
    }
    query.push(("include_changelog", "false".to_string()));

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
    Ok(versions)
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
