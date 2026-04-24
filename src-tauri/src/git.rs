//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.

use std::path::{Path, PathBuf};

use git2::{Cred, IndexAddOption, PushOptions, RemoteCallbacks, Repository, Signature, StatusOptions};

pub enum PushAuth {
    Pat(String),
    Ssh,
}

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

pub fn commit_and_push(repo_dir: &Path, message: &str, auth: PushAuth) -> Result<String, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    let branch = repo
        .head()?
        .shorthand()
        .map(str::to_owned)
        .ok_or_else(|| git2::Error::from_str("current branch missing"))?;

    let mut status_options = StatusOptions::new();
    status_options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let has_changes = !repo.statuses(Some(&mut status_options))?.is_empty();

    let commit_sha = if has_changes {
        let mut index = repo.index()?;
        index.add_all(["*"], IndexAddOption::DEFAULT, None)?;
        index.write()?;
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;
        let signature = repo
            .signature()
            .or_else(|_| Signature::now("modsync", "modsync@local"))?;
        repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[&head])?
            .to_string()
    } else {
        head.id().to_string()
    };

    push_branch(&repo, &branch, auth)?;
    Ok(commit_sha)
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

fn push_branch(repo: &Repository, branch: &str, auth: PushAuth) -> Result<(), GitError> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username_from_url, allowed_types| match &auth {
        PushAuth::Pat(token) => {
            if allowed_types.is_user_pass_plaintext() {
                Cred::userpass_plaintext("x-access-token", token)
            } else if allowed_types.is_username() {
                Cred::username(username_from_url.unwrap_or("git"))
            } else {
                Err(git2::Error::from_str("remote does not accept PAT credentials"))
            }
        }
        PushAuth::Ssh => {
            if allowed_types.is_ssh_key() {
                ssh_credential(username_from_url.unwrap_or("git"))
            } else if allowed_types.is_username() {
                Cred::username(username_from_url.unwrap_or("git"))
            } else {
                Err(git2::Error::from_str("remote does not accept SSH agent credentials"))
            }
        }
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    let mut remote = repo.find_remote("origin")?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    remote.push(&[refspec], Some(&mut push_options))?;
    Ok(())
}

fn ssh_credential(username: &str) -> Result<Cred, git2::Error> {
    Cred::ssh_key_from_agent(username).or_else(|_| {
        for private_key in default_ssh_private_keys() {
            if !private_key.exists() {
                continue;
            }
            if let Ok(cred) = Cred::ssh_key(username, None, &private_key, None) {
                return Ok(cred);
            }
        }
        Err(git2::Error::from_str(
            "SSH auth failed: no agent key and no usable private key in ~/.ssh",
        ))
    })
}

fn default_ssh_private_keys() -> Vec<PathBuf> {
    let Some(home) = std::env::var_os("HOME") else {
        return Vec::new();
    };
    let ssh_dir = PathBuf::from(home).join(".ssh");
    ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"]
        .into_iter()
        .map(|name| ssh_dir.join(name))
        .collect()
}
