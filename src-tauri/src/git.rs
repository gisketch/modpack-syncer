//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.

use std::path::Path;

use git2::{FetchOptions, Repository};

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error(transparent)]
    Git(#[from] git2::Error),
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
}

/// Clone a public pack repo to `dest`. If `dest` already contains a git repo,
/// fetches and fast-forwards instead.
pub fn clone_or_update(url: &str, dest: &Path) -> Result<String, GitError> {
    if dest.join(".git").exists() {
        return fetch_and_ff(dest);
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut fo = FetchOptions::new();
    fo.depth(1);
    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fo);
    let repo = builder.clone(url, dest)?;
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
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
