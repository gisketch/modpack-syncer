//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.

use std::path::{Path, PathBuf};

use git2::{
    build::CheckoutBuilder, Cred, IndexAddOption, PushOptions, RemoteCallbacks, Repository,
    ResetType, Signature, StatusOptions,
};

pub enum PushAuth {
    Pat(String),
    Ssh,
}

pub struct SshAccess {
    pub source: String,
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
/// fetches and aligns the current branch to the fetched remote head.
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
    // Align current branch to FETCH_HEAD, including force-pushed remote histories.
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    let analysis = repo.merge_analysis(&[&fetch_commit])?;
    if analysis.0.is_up_to_date() {
        let head = repo.head()?.peel_to_commit()?;
        return Ok(head.id().to_string());
    }
    let refname = {
        let head = repo.head()?;
        head.name().unwrap_or("HEAD").to_string()
    };
    if analysis.0.is_fast_forward() {
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "modsync fast-forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(CheckoutBuilder::default().force()))?;
    } else {
        let target = repo.find_commit(fetch_commit.id())?;
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "modsync force update")?;
        repo.set_head(&refname)?;
        repo.reset(
            target.as_object(),
            ResetType::Hard,
            Some(CheckoutBuilder::default().force()),
        )?;
    }
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn head_sha(repo_dir: &Path) -> Result<String, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn commit_and_push_with_filter<F>(
    repo_dir: &Path,
    message: &str,
    auth: PushAuth,
    should_include_path: F,
) -> Result<String, GitError>
where
    F: Fn(&Path) -> bool,
{
    eprintln!("[modsync] publish push: open repo {}", repo_dir.display());
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
    let statuses = repo.statuses(Some(&mut status_options))?;
    let has_changes = statuses.iter().any(|status| {
        status
            .path()
            .is_some_and(|path| should_include_path(Path::new(path)))
    });

    let commit_sha = if has_changes {
        eprintln!("[modsync] publish push: create commit");
        let mut index = repo.index()?;
        index.add_all(
            ["*"],
            IndexAddOption::DEFAULT,
            Some(&mut |path, _matched| {
                if should_include_path(path) {
                    0
                } else {
                    1
                }
            }),
        )?;
        index.write()?;
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;
        let signature = repo
            .signature()
            .or_else(|_| Signature::now("modsync", "modsync@local"))?;
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&head],
        )?
        .to_string()
    } else {
        eprintln!("[modsync] publish push: no local changes, push current HEAD");
        head.id().to_string()
    };

    eprintln!("[modsync] publish push: push branch {branch}");
    push_branch(&repo, &branch, auth)?;
    eprintln!("[modsync] publish push: push complete {commit_sha}");
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
    let use_ssh_transport = matches!(&auth, PushAuth::Ssh);
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username_from_url, allowed_types| match &auth {
        PushAuth::Pat(token) => {
            eprintln!("[modsync] publish push: PAT credential callback");
            if allowed_types.is_user_pass_plaintext() {
                Cred::userpass_plaintext("x-access-token", token)
            } else if allowed_types.is_username() {
                Cred::username(username_from_url.unwrap_or("git"))
            } else {
                Err(git2::Error::from_str(
                    "remote does not accept PAT credentials",
                ))
            }
        }
        PushAuth::Ssh => {
            eprintln!("[modsync] publish push: SSH credential callback");
            if allowed_types.is_ssh_key() {
                resolve_ssh_credential(username_from_url.unwrap_or("git")).map(|(cred, _)| cred)
            } else if allowed_types.is_username() {
                Cred::username(username_from_url.unwrap_or("git"))
            } else {
                Err(git2::Error::from_str(
                    "remote does not accept SSH agent credentials",
                ))
            }
        }
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    if use_ssh_transport {
        let origin = repo.find_remote("origin")?;
        let origin_url = origin
            .url()
            .map(str::to_owned)
            .ok_or_else(|| git2::Error::from_str("origin remote missing url"))?;
        let previous_pushurl = origin.pushurl().map(str::to_owned);
        drop(origin);

        let push_url = ssh_push_url(&origin_url).unwrap_or(origin_url);
        eprintln!("[modsync] publish push: SSH pushurl {push_url}");
        repo.remote_set_pushurl("origin", Some(&push_url))?;
        let result = {
            let mut remote = repo.find_remote("origin")?;
            eprintln!("[modsync] publish push: remote.push start");
            remote.push(&[refspec], Some(&mut push_options))
        };
        repo.remote_set_pushurl("origin", previous_pushurl.as_deref())?;
        result?;
    } else {
        let mut remote = repo.find_remote("origin")?;
        eprintln!("[modsync] publish push: HTTPS push via origin");
        remote.push(&[refspec], Some(&mut push_options))?;
    }
    Ok(())
}

pub fn verify_ssh_access() -> Result<SshAccess, GitError> {
    let (_, source) = resolve_ssh_credential("git")?;
    Ok(SshAccess { source })
}

fn resolve_ssh_credential(username: &str) -> Result<(Cred, String), git2::Error> {
    for private_key in default_ssh_private_keys() {
        if !private_key.exists() {
            continue;
        }
        let public_key = private_key.with_extension("pub");
        let public_key = public_key.exists().then_some(public_key.as_path());
        if let Ok(cred) = Cred::ssh_key(username, public_key, &private_key, None) {
            return Ok((cred, private_key.display().to_string()));
        }
    }
    if let Ok(cred) = Cred::ssh_key_from_agent(username) {
        return Ok((cred, "ssh-agent".to_string()));
    }
    Err(git2::Error::from_str(
        "SSH auth failed: no agent key and no usable private key in ~/.ssh",
    ))
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

fn ssh_push_url(origin_url: &str) -> Option<String> {
    if origin_url.starts_with("git@") || origin_url.starts_with("ssh://") {
        return Some(origin_url.to_string());
    }
    let parsed = url::Url::parse(origin_url).ok()?;
    let host = parsed.host_str()?;
    let path = parsed.path().trim_start_matches('/');
    if path.is_empty() {
        return None;
    }
    Some(format!("ssh://git@{host}/{path}"))
}
