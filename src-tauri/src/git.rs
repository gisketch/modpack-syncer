//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.

use std::path::{Path, PathBuf};

use git2::Repository;

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error(transparent)]
    Git(#[from] git2::Error),
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
    #[error("repo corrupted and has local changes; reclone manually: {0}")]
    CorruptDirty(String),
}

/// Clone a public pack repo to `dest`. If `dest` already contains a git repo,
/// fetches and fast-forwards instead.
pub fn clone_or_update(url: &str, dest: &Path) -> Result<String, GitError> {
    if dest.join(".git").exists() {
        return update(dest);
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let repo = Repository::clone(url, dest)?;
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn update(repo_dir: &Path) -> Result<String, GitError> {
    match fetch_and_ff(repo_dir) {
        Ok(head) => Ok(head),
        Err(GitError::Git(err)) if is_missing_object_error(&err) => recover_broken_clone(repo_dir),
        Err(err) => Err(err),
    }
}

fn fetch_and_ff(dest: &Path) -> Result<String, GitError> {
    let repo = Repository::open(dest)?;
    {
        let mut remote = repo.find_remote("origin")?;
        remote.fetch::<&str>(&[], None, None)?;
    }
    // Fast-forward current branch to FETCH_HEAD.
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    let analysis = repo.merge_analysis(&[&fetch_commit])?;
    if analysis.0.is_up_to_date() {
        let head = repo.head()?.peel_to_commit()?;
        return Ok(head.id().to_string());
    }
    if analysis.0.is_fast_forward() {
        let refname = {
            let head = repo.head()?;
            head.name().unwrap_or("HEAD").to_string()
        };
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "modsync fast-forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
    }
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn head_sha(repo_dir: &Path) -> Result<String, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn read_head_parent_file(repo_dir: &Path, rel_path: &str) -> Result<Option<Vec<u8>>, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    let Some(parent) = head.parents().next() else {
        return Ok(None);
    };
    let tree = parent.tree()?;
    let Ok(entry) = tree.get_path(Path::new(rel_path)) else {
        return Ok(None);
    };
    let blob = repo.find_blob(entry.id())?;
    Ok(Some(blob.content().to_vec()))
}

fn is_missing_object_error(err: &git2::Error) -> bool {
    let msg = err.message().to_ascii_lowercase();
    err.class() == git2::ErrorClass::Odb
        || msg.contains("object not found")
        || msg.contains("missing commit")
}

fn recover_broken_clone(repo_dir: &Path) -> Result<String, GitError> {
    let repo = Repository::open(repo_dir)?;
    let origin = repo
        .find_remote("origin")?
        .url()
        .map(str::to_owned)
        .ok_or_else(|| git2::Error::from_str("origin remote missing url"))?;
    if !repo.statuses(None)?.is_empty() {
        return Err(GitError::CorruptDirty(repo_dir.display().to_string()));
    }
    drop(repo);

    let backup = broken_backup_dir(repo_dir);
    if backup.exists() {
        std::fs::remove_dir_all(&backup)?;
    }
    std::fs::rename(repo_dir, &backup)?;

    match Repository::clone(&origin, repo_dir) {
        Ok(repo) => {
            let head = repo.head()?.peel_to_commit()?.id().to_string();
            let _ = std::fs::remove_dir_all(&backup);
            Ok(head)
        }
        Err(err) => {
            let _ = std::fs::remove_dir_all(repo_dir);
            let _ = std::fs::rename(&backup, repo_dir);
            Err(GitError::Git(err))
        }
    }
}

fn broken_backup_dir(repo_dir: &Path) -> PathBuf {
    repo_dir.with_extension("corrupt")
}
