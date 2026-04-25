use std::collections::{BTreeMap, HashSet};

use git2::{Delta, Repository};

use super::{CommandError, PackChangelogEntry, PackChangelogItem, PublishAction, PublishCategory};
use crate::{manifest, paths};

#[tauri::command]
pub async fn pack_changelog(
    pack_id: String,
    limit: Option<usize>,
    since_commit: Option<String>,
) -> Result<Vec<PackChangelogEntry>, CommandError> {
    let pack_dir = paths::packs_dir()?.join(&pack_id);
    let limit = limit.unwrap_or(12);
    tokio::task::spawn_blocking(move || {
        load_pack_changelog(&pack_dir, limit, since_commit.as_deref())
    })
    .await
    .map_err(|e| CommandError::Other(e.to_string()))?
}

fn load_pack_changelog(
    repo_dir: &std::path::Path,
    limit: usize,
    since_commit: Option<&str>,
) -> Result<Vec<PackChangelogEntry>, CommandError> {
    let repo = Repository::open(repo_dir)?;
    let mut walk = repo.revwalk()?;
    walk.push_head()?;

    let mut entries = Vec::new();
    for oid in walk {
        let oid = oid?;
        if since_commit.is_some_and(|base| oid.to_string() == base) {
            break;
        }
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;
        let parent = commit.parents().next();
        let parent_tree = parent.as_ref().map(|p| p.tree()).transpose()?;
        let current_manifest = manifest_from_tree(&repo, &tree)?;
        let previous_manifest = match parent_tree.as_ref() {
            Some(parent_tree) => manifest_from_tree(&repo, parent_tree)?,
            None => None,
        };

        let mut items = Vec::new();
        items.extend(diff_manifest_category(
            previous_manifest
                .as_ref()
                .map(|manifest| manifest.mods.as_slice())
                .unwrap_or(&[]),
            current_manifest
                .as_ref()
                .map(|manifest| manifest.mods.as_slice())
                .unwrap_or(&[]),
            PublishCategory::Mods,
        ));
        items.extend(diff_manifest_category(
            previous_manifest
                .as_ref()
                .map(|manifest| manifest.resourcepacks.as_slice())
                .unwrap_or(&[]),
            current_manifest
                .as_ref()
                .map(|manifest| manifest.resourcepacks.as_slice())
                .unwrap_or(&[]),
            PublishCategory::Resourcepacks,
        ));
        items.extend(diff_manifest_category(
            previous_manifest
                .as_ref()
                .map(|manifest| manifest.shaderpacks.as_slice())
                .unwrap_or(&[]),
            current_manifest
                .as_ref()
                .map(|manifest| manifest.shaderpacks.as_slice())
                .unwrap_or(&[]),
            PublishCategory::Shaderpacks,
        ));

        let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;
        let mut details_map: BTreeMap<(u8, u8), Vec<String>> = BTreeMap::new();
        for delta in diff.deltas() {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|path| path.to_string_lossy().replace('\\', "/"));
            let Some(path) = path else {
                continue;
            };
            let Some(category) = changelog_tree_category(&path) else {
                continue;
            };
            let action = match delta.status() {
                Delta::Added => PublishAction::Add,
                Delta::Deleted => PublishAction::Remove,
                Delta::Modified | Delta::Renamed | Delta::Copied | Delta::Typechange => {
                    PublishAction::Update
                }
                _ => continue,
            };
            details_map
                .entry((action_rank(&action), category_rank(&category)))
                .or_default()
                .push(tree_change_detail(&delta, &path));
        }

        for ((action_rank_value, category_rank_value), details) in details_map {
            let action = action_from_rank(action_rank_value);
            let category = category_from_rank(category_rank_value);
            if matches!(
                category,
                PublishCategory::Mods
                    | PublishCategory::Resourcepacks
                    | PublishCategory::Shaderpacks
            ) {
                continue;
            }
            items.push(PackChangelogItem {
                action,
                category,
                count: details.len(),
                details,
            });
        }

        items.sort_by_key(|item| (action_rank(&item.action), category_rank(&item.category)));
        entries.push(PackChangelogEntry {
            commit_sha: commit.id().to_string(),
            pack_version: current_manifest
                .as_ref()
                .map(|manifest| manifest.pack.version.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            title: commit.summary().unwrap_or("Update").to_string(),
            description: commit.body().unwrap_or("").trim().to_string(),
            committed_at: commit.time().seconds(),
            items,
        });

        if entries.len() >= limit {
            break;
        }
    }

    Ok(entries)
}

fn manifest_from_tree(
    repo: &git2::Repository,
    tree: &git2::Tree<'_>,
) -> Result<Option<manifest::Manifest>, CommandError> {
    let Ok(entry) = tree.get_path(std::path::Path::new("manifest.json")) else {
        return Ok(None);
    };
    let blob = repo.find_blob(entry.id())?;
    let manifest = serde_json::from_slice::<manifest::Manifest>(blob.content())
        .map_err(|error| CommandError::Manifest(error.to_string()))?;
    Ok(Some(manifest))
}

fn diff_manifest_category(
    previous: &[manifest::Entry],
    current: &[manifest::Entry],
    category: PublishCategory,
) -> Vec<PackChangelogItem> {
    let previous_map = previous
        .iter()
        .map(|entry| (manifest_entry_key(entry), entry))
        .collect::<BTreeMap<_, _>>();
    let current_map = current
        .iter()
        .map(|entry| (manifest_entry_key(entry), entry))
        .collect::<BTreeMap<_, _>>();
    let mut seen = HashSet::new();
    let mut add = 0usize;
    let mut update = 0usize;
    let mut remove = 0usize;
    let mut add_details = Vec::new();
    let mut update_details = Vec::new();
    let mut remove_details = Vec::new();

    for (key, entry) in &current_map {
        seen.insert(key.clone());
        match previous_map.get(key) {
            None => {
                add += 1;
                add_details.push(manifest_entry_label(entry));
            }
            Some(previous_entry)
                if previous_entry.sha1 != entry.sha1
                    || previous_entry.filename != entry.filename
                    || previous_entry.repo_path != entry.repo_path =>
            {
                update += 1;
                update_details.push(manifest_update_label(previous_entry, entry));
            }
            Some(_) => {}
        }
    }

    for key in previous_map.keys() {
        if !seen.contains(key) {
            remove += 1;
            if let Some(entry) = previous_map.get(key) {
                remove_details.push(manifest_entry_label(entry));
            }
        }
    }

    let mut items = Vec::new();
    if add > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Add,
            category: category.clone(),
            count: add,
            details: add_details,
        });
    }
    if update > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Update,
            category: category.clone(),
            count: update,
            details: update_details,
        });
    }
    if remove > 0 {
        items.push(PackChangelogItem {
            action: PublishAction::Remove,
            category,
            count: remove,
            details: remove_details,
        });
    }
    items
}

fn manifest_entry_key(entry: &manifest::Entry) -> String {
    if !entry.id.is_empty() {
        return entry.id.clone();
    }
    entry.filename.clone()
}

fn changelog_tree_category(path: &str) -> Option<PublishCategory> {
    if path == "options.txt" {
        return Some(PublishCategory::Root);
    }
    if path == "configs/iris.properties"
        || (path.starts_with("shaderpacks/") && path.ends_with(".txt"))
    {
        return Some(PublishCategory::ShaderSettings);
    }
    if path.starts_with("configs/") {
        return Some(PublishCategory::Config);
    }
    if path.starts_with("presets/") {
        return Some(PublishCategory::OptionPresets);
    }
    if path.starts_with("kubejs/") {
        return Some(PublishCategory::Kubejs);
    }
    None
}

fn tree_change_detail(delta: &git2::DiffDelta<'_>, path: &str) -> String {
    let old_path = delta
        .old_file()
        .path()
        .map(|value| value.to_string_lossy().replace('\\', "/"));
    let new_path = delta
        .new_file()
        .path()
        .map(|value| value.to_string_lossy().replace('\\', "/"));
    match (old_path, new_path) {
        (Some(old_path), Some(new_path)) if old_path != new_path => {
            format!("{old_path} -> {new_path}")
        }
        _ => path.to_string(),
    }
}

fn manifest_entry_label(entry: &manifest::Entry) -> String {
    if !entry.id.is_empty() {
        return entry.id.clone();
    }
    entry
        .filename
        .trim_end_matches(".jar")
        .trim_end_matches(".zip")
        .to_string()
}

fn manifest_update_label(previous: &manifest::Entry, current: &manifest::Entry) -> String {
    let label = if !current.id.is_empty() {
        current.id.clone()
    } else if !previous.id.is_empty() {
        previous.id.clone()
    } else {
        current.filename.clone()
    };
    format!("{label}: {} -> {}", previous.filename, current.filename)
}

fn action_rank(action: &PublishAction) -> u8 {
    match action {
        PublishAction::Add => 0,
        PublishAction::Update => 1,
        PublishAction::Remove => 2,
        PublishAction::Unchanged => 3,
    }
}

fn category_rank(category: &PublishCategory) -> u8 {
    match category {
        PublishCategory::Mods => 0,
        PublishCategory::Resourcepacks => 1,
        PublishCategory::Shaderpacks => 2,
        PublishCategory::ShaderSettings => 3,
        PublishCategory::OptionPresets => 4,
        PublishCategory::Config => 5,
        PublishCategory::Kubejs => 6,
        PublishCategory::Root => 7,
    }
}

fn action_from_rank(rank: u8) -> PublishAction {
    match rank {
        0 => PublishAction::Add,
        1 => PublishAction::Update,
        2 => PublishAction::Remove,
        _ => PublishAction::Unchanged,
    }
}

fn category_from_rank(rank: u8) -> PublishCategory {
    match rank {
        0 => PublishCategory::Mods,
        1 => PublishCategory::Resourcepacks,
        2 => PublishCategory::Shaderpacks,
        3 => PublishCategory::ShaderSettings,
        4 => PublishCategory::OptionPresets,
        5 => PublishCategory::Config,
        6 => PublishCategory::Kubejs,
        _ => PublishCategory::Root,
    }
}
