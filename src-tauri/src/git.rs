//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.

use std::cell::RefCell;
use std::path::{Path, PathBuf};

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    Cred, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks, Repository, ResetType,
    Signature, StatusOptions,
};

pub enum PushAuth {
    Pat(String),
    Ssh,
}

#[derive(Debug, Clone)]
pub struct PushProgress {
    pub stage: &'static str,
    pub current_path: Option<String>,
    pub completed: usize,
    pub total: usize,
    pub bytes: Option<usize>,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GitTransferProgress {
    pub stage: &'static str,
    pub received_objects: usize,
    pub total_objects: usize,
    pub indexed_objects: usize,
    pub received_bytes: usize,
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

pub fn init_local_repo(repo_dir: &Path, message: &str) -> Result<String, GitError> {
    std::fs::create_dir_all(repo_dir)?;
    let repo = Repository::init(repo_dir)?;
    repo.set_head("refs/heads/main")?;

    let mut index = repo.index()?;
    index.add_all(["*"], IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let signature = repo
        .signature()
        .or_else(|_| Signature::now("modsync", "modsync@local"))?;
    let commit = repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[])?;
    Ok(commit.to_string())
}

/// Clone a public pack repo to `dest`. If `dest` already contains a git repo,
/// fetches and aligns the current branch to the fetched remote head.
pub fn clone_or_update_with_progress<P>(
    url: &str,
    dest: &Path,
    mut on_progress: P,
) -> Result<String, GitError>
where
    P: FnMut(GitTransferProgress),
{
    if dest.join(".git").exists() {
        return update_with_progress(dest, on_progress);
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let repo = {
        let mut builder = RepoBuilder::new();
        let fetch_options = fetch_options("cloning", &mut on_progress);
        builder.fetch_options(fetch_options);
        builder.clone(url, dest)?
    };
    let head = repo.head()?.peel_to_commit()?;
    on_progress(GitTransferProgress {
        stage: "done",
        received_objects: 0,
        total_objects: 0,
        indexed_objects: 0,
        received_bytes: 0,
    });
    Ok(head.id().to_string())
}

pub fn update_with_progress<P>(repo_dir: &Path, mut on_progress: P) -> Result<String, GitError>
where
    P: FnMut(GitTransferProgress),
{
    if !has_origin(repo_dir)? {
        let head = head_sha(repo_dir)?;
        on_progress(done_transfer_progress());
        return Ok(head);
    }
    match fetch_and_ff(repo_dir, &mut on_progress, true) {
        Ok(head) => Ok(head),
        Err(GitError::Git(err)) if is_missing_object_error(&err) => recover_broken_clone(repo_dir),
        Err(err) => Err(err),
    }
}

pub fn update_if_changed_with_progress<P>(
    repo_dir: &Path,
    mut on_progress: P,
) -> Result<String, GitError>
where
    P: FnMut(GitTransferProgress),
{
    if !has_origin(repo_dir)? {
        let head = head_sha(repo_dir)?;
        on_progress(done_transfer_progress());
        return Ok(head);
    }
    match fetch_and_ff(repo_dir, &mut on_progress, false) {
        Ok(head) => Ok(head),
        Err(GitError::Git(err)) if is_missing_object_error(&err) => recover_broken_clone(repo_dir),
        Err(err) => Err(err),
    }
}

fn done_transfer_progress() -> GitTransferProgress {
    GitTransferProgress {
        stage: "done",
        received_objects: 0,
        total_objects: 0,
        indexed_objects: 0,
        received_bytes: 0,
    }
}

fn fetch_and_ff<P>(
    dest: &Path,
    on_progress: &mut P,
    clean_when_unchanged: bool,
) -> Result<String, GitError>
where
    P: FnMut(GitTransferProgress),
{
    let repo = Repository::open(dest)?;
    {
        let mut remote = repo.find_remote("origin")?;
        let mut fetch_options = fetch_options("fetching", on_progress);
        remote.fetch::<&str>(&[], Some(&mut fetch_options), None)?;
    }
    // Align current branch to FETCH_HEAD, including force-pushed remote histories.
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    let analysis = repo.merge_analysis(&[&fetch_commit])?;
    if analysis.0.is_up_to_date() {
        let head = repo.head()?.peel_to_commit()?;
        if clean_when_unchanged {
            checkout_head_clean(&repo)?;
        }
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
        checkout_head_clean(&repo)?;
    } else {
        let target = repo.find_commit(fetch_commit.id())?;
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "modsync force update")?;
        repo.set_head(&refname)?;
        reset_hard_clean(&repo, &target)?;
    }
    let head = repo.head()?.peel_to_commit()?;
    on_progress(GitTransferProgress {
        stage: "done",
        received_objects: 0,
        total_objects: 0,
        indexed_objects: 0,
        received_bytes: 0,
    });
    Ok(head.id().to_string())
}

fn fetch_options<'a, P>(stage: &'static str, on_progress: &'a mut P) -> FetchOptions<'a>
where
    P: FnMut(GitTransferProgress) + 'a,
{
    let mut callbacks = RemoteCallbacks::new();
    callbacks.transfer_progress(move |progress| {
        on_progress(GitTransferProgress {
            stage,
            received_objects: progress.received_objects(),
            total_objects: progress.total_objects(),
            indexed_objects: progress.indexed_objects(),
            received_bytes: progress.received_bytes(),
        });
        true
    });
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    fetch_options
}

fn checkout_head_clean(repo: &Repository) -> Result<(), GitError> {
    let mut checkout = CheckoutBuilder::new();
    checkout.force().remove_untracked(true);
    repo.checkout_head(Some(&mut checkout))?;
    Ok(())
}

fn reset_hard_clean(repo: &Repository, target: &git2::Commit<'_>) -> Result<(), GitError> {
    let mut checkout = CheckoutBuilder::new();
    checkout.force().remove_untracked(true);
    repo.reset(target.as_object(), ResetType::Hard, Some(&mut checkout))?;
    Ok(())
}

pub fn head_sha(repo_dir: &Path) -> Result<String, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    Ok(head.id().to_string())
}

pub fn origin_url(repo_dir: &Path) -> Result<Option<String>, GitError> {
    let repo = Repository::open(repo_dir)?;
    Ok(repo
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(str::to_owned)))
}

pub fn has_origin(repo_dir: &Path) -> Result<bool, GitError> {
    Ok(origin_url(repo_dir)?.is_some())
}

pub fn commit_and_push_with_filter_progress<F, P>(
    repo_dir: &Path,
    message: &str,
    auth: PushAuth,
    should_include_path: F,
    amend: bool,
    on_progress: P,
) -> Result<String, GitError>
where
    F: Fn(&Path) -> bool,
    P: FnMut(PushProgress),
{
    eprintln!("[modsync] publish push: open repo {}", repo_dir.display());
    let mut on_progress = on_progress;
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
    let changed_paths = statuses
        .iter()
        .filter_map(|status| status.path().map(PathBuf::from))
        .filter(|path| should_include_path(path))
        .collect::<Vec<_>>();
    let has_changes = !changed_paths.is_empty();

    let commit_sha = if has_changes || amend {
        eprintln!(
            "[modsync] publish push: {} commit",
            if amend { "amend" } else { "create" }
        );
        let mut index = repo.index()?;
        let mut staged = 0usize;
        let total_to_stage = changed_paths.len().max(1);
        index.add_all(
            ["*"],
            IndexAddOption::DEFAULT,
            Some(&mut |path, _matched| {
                if should_include_path(path) {
                    staged += 1;
                    on_progress(PushProgress {
                        stage: "staging",
                        current_path: Some(path.to_string_lossy().replace('\\', "/")),
                        completed: staged.min(total_to_stage),
                        total: total_to_stage,
                        bytes: None,
                        message: Some(format!(
                            "stage file :: {} ({}/{})",
                            path.display(),
                            staged.min(total_to_stage),
                            total_to_stage
                        )),
                    });
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
        if amend {
            head.amend(
                Some("HEAD"),
                Some(&signature),
                Some(&signature),
                None,
                Some(message),
                Some(&tree),
            )?
            .to_string()
        } else {
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&head],
            )?
            .to_string()
        }
    } else {
        eprintln!("[modsync] publish push: no local changes, push current HEAD");
        head.id().to_string()
    };

    eprintln!("[modsync] publish push: push branch {branch}");
    push_branch(&repo, &branch, auth, amend, &mut on_progress)?;
    eprintln!("[modsync] publish push: push complete {commit_sha}");
    on_progress(PushProgress {
        stage: "done",
        current_path: None,
        completed: 1,
        total: 1,
        bytes: None,
        message: Some(format!(
            "push complete :: {}",
            &commit_sha[..10.min(commit_sha.len())]
        )),
    });
    Ok(commit_sha)
}

pub fn read_head_file(repo_dir: &Path, rel_path: &str) -> Result<Option<Vec<u8>>, GitError> {
    let repo = Repository::open(repo_dir)?;
    let head = repo.head()?.peel_to_commit()?;
    let tree = head.tree()?;
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

fn push_branch(
    repo: &Repository,
    branch: &str,
    auth: PushAuth,
    force: bool,
    on_progress: &mut dyn FnMut(PushProgress),
) -> Result<(), GitError> {
    let use_ssh_transport = matches!(&auth, PushAuth::Ssh);
    let progress = RefCell::new(on_progress);
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
    callbacks.pack_progress(|stage, current, total| {
        let stage_name = match stage {
            git2::PackBuilderStage::AddingObjects => "packing-objects",
            git2::PackBuilderStage::Deltafication => "delta-compression",
        };
        (*progress.borrow_mut())(PushProgress {
            stage: stage_name,
            current_path: None,
            completed: current,
            total,
            bytes: None,
            message: None,
        });
    });
    callbacks.push_transfer_progress(|current, total, bytes| {
        (*progress.borrow_mut())(PushProgress {
            stage: "uploading",
            current_path: None,
            completed: current,
            total,
            bytes: Some(bytes),
            message: None,
        });
    });
    callbacks.sideband_progress(|bytes| {
        let message = String::from_utf8_lossy(bytes).trim().to_string();
        if !message.is_empty() {
            (*progress.borrow_mut())(PushProgress {
                stage: "remote",
                current_path: None,
                completed: 0,
                total: 0,
                bytes: None,
                message: Some(format!("remote :: {message}")),
            });
        }
        true
    });
    callbacks.push_update_reference(|reference, status| {
        if let Some(status) = status {
            return Err(git2::Error::from_str(&format!(
                "remote rejected {reference}: {status}"
            )));
        }
        (*progress.borrow_mut())(PushProgress {
            stage: "updating-ref",
            current_path: None,
            completed: 1,
            total: 1,
            bytes: None,
            message: Some(format!("remote accepted :: {reference}")),
        });
        Ok(())
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    let refspec = if force {
        format!("+refs/heads/{branch}:refs/heads/{branch}")
    } else {
        format!("refs/heads/{branch}:refs/heads/{branch}")
    };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_repo_without_origin_updates_as_current() {
        let repo_dir = std::env::temp_dir().join(format!(
            "modsync-local-repo-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock after epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&repo_dir).expect("create temp repo dir");
        std::fs::write(repo_dir.join("manifest.json"), "{}").expect("write manifest");

        let head = init_local_repo(&repo_dir, "Initial local pack").expect("init local repo");
        assert_eq!(origin_url(&repo_dir).expect("read origin"), None);
        let updated =
            update_if_changed_with_progress(&repo_dir, |_| {}).expect("update local repo");
        assert_eq!(updated, head);

        let _ = std::fs::remove_dir_all(repo_dir);
    }
}
