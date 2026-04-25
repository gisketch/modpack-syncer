//! Parallel HTTP download pipeline with resume + SHA verify.
//! Uses reqwest + tokio Semaphore. Verifies every artifact against the
//! manifest-declared SHA1 (and SHA512 if present) before admitting to cache.

use std::sync::Arc;

use futures::stream::{FuturesUnordered, StreamExt};
use once_cell::sync::Lazy;
use reqwest::Client;
use sha1::{Digest as _, Sha1};
use sha2::Sha512;
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

use crate::{
    cache,
    manifest::{Entry, Source},
};

const MAX_PARALLEL: usize = 8;
const USER_AGENT: &str = concat!("modsync/", env!("CARGO_PKG_VERSION"));

static CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .user_agent(USER_AGENT)
        .http2_prior_knowledge()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .expect("reqwest client")
});

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
    #[error("sha1 mismatch for {filename}: expected {expected}, got {actual}")]
    Sha1Mismatch {
        filename: String,
        expected: String,
        actual: String,
    },
    #[error("sha512 mismatch for {filename}")]
    Sha512Mismatch { filename: String },
    #[error("disallowed url host: {0}")]
    DisallowedHost(String),
    #[error("repo entry missing repoPath: {0}")]
    MissingRepoPath(String),
}

fn url_host_allowed(url: &str) -> bool {
    // Minimal allowlist for M1. Additional hosts merged in later from user settings.
    const DEFAULTS: &[&str] = &[
        "cdn.modrinth.com",
        "edge.forgecdn.net",
        "mediafilez.forgecdn.net",
    ];
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    match parsed.host_str() {
        Some(host) => DEFAULTS.iter().any(|h| host.eq_ignore_ascii_case(h)),
        None => false,
    }
}

/// Download a single manifest entry into the content-addressable cache.
/// No-op if a valid copy already exists.
pub async fn fetch_entry(entry: &Entry) -> Result<std::path::PathBuf, DownloadError> {
    if entry.source == Source::Repo {
        return Err(DownloadError::MissingRepoPath(entry.filename.clone()));
    }
    let sha1_expected = entry.sha1.to_ascii_lowercase();
    let cache_path = cache::path_for(&sha1_expected)?;

    if cache::exists_and_matches(&sha1_expected)? {
        return Ok(cache_path);
    }

    if !url_host_allowed(&entry.url) {
        return Err(DownloadError::DisallowedHost(entry.url.clone()));
    }

    // Download to `<cache_path>.part`, hash as we write, then atomically rename.
    let part_path = cache_path.with_extension("part");
    if part_path.exists() {
        std::fs::remove_file(&part_path)?;
    }

    let mut resp = CLIENT.get(&entry.url).send().await?.error_for_status()?;
    let mut file = tokio::fs::File::create(&part_path).await?;
    let mut sha1 = Sha1::new();
    let mut sha512 = Sha512::new();
    let compute_sha512 = entry.sha512.is_some();

    while let Some(chunk) = resp.chunk().await? {
        sha1.update(&chunk);
        if compute_sha512 {
            sha512.update(&chunk);
        }
        file.write_all(&chunk).await?;
    }
    file.flush().await?;
    drop(file);

    let got_sha1 = hex::encode(sha1.finalize());
    if got_sha1 != sha1_expected {
        let _ = std::fs::remove_file(&part_path);
        return Err(DownloadError::Sha1Mismatch {
            filename: entry.filename.clone(),
            expected: sha1_expected,
            actual: got_sha1,
        });
    }
    if let Some(expected_512) = entry.sha512.as_ref() {
        let got = hex::encode(sha512.finalize());
        if !got.eq_ignore_ascii_case(expected_512) {
            let _ = std::fs::remove_file(&part_path);
            return Err(DownloadError::Sha512Mismatch {
                filename: entry.filename.clone(),
            });
        }
    }

    std::fs::rename(&part_path, &cache_path)?;
    Ok(cache_path)
}

pub fn verify_file(path: &std::path::Path, entry: &Entry) -> Result<(), DownloadError> {
    let got_sha1 = cache::file_sha1_hex(path)?;
    let expected_sha1 = entry.sha1.to_ascii_lowercase();
    if got_sha1 != expected_sha1 {
        return Err(DownloadError::Sha1Mismatch {
            filename: entry.filename.clone(),
            expected: expected_sha1,
            actual: got_sha1,
        });
    }
    if let Some(expected_512) = entry.sha512.as_ref() {
        let mut file = std::fs::File::open(path)?;
        let mut hasher = Sha512::new();
        std::io::copy(&mut file, &mut hasher)?;
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(expected_512) {
            return Err(DownloadError::Sha512Mismatch {
                filename: entry.filename.clone(),
            });
        }
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FetchReport {
    pub total: usize,
    pub cached: usize,
    pub downloaded: usize,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FetchProgress {
    pub filename: String,
    pub status: &'static str, // "downloading" | "cached" | "downloaded" | "failed"
    pub completed: usize,
    pub total: usize,
    pub cached: usize,
    pub downloaded: usize,
    pub failures: usize,
}

pub async fn fetch_all(entries: Vec<Entry>) -> FetchReport {
    fetch_all_with_progress(entries, |_| {}).await
}

pub async fn fetch_all_with_progress<F>(entries: Vec<Entry>, mut on_progress: F) -> FetchReport
where
    F: FnMut(FetchProgress) + Send,
{
    let sem = Arc::new(Semaphore::new(MAX_PARALLEL));
    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let mut tasks: FuturesUnordered<_> = entries
        .into_iter()
        .map(|entry| {
            let sem = sem.clone();
            let progress_tx = progress_tx.clone();
            async move {
                let _permit = sem.acquire_owned().await.unwrap();
                let was_cached = cache::exists_and_matches(&entry.sha1).unwrap_or(false);
                let _ = progress_tx.send(entry.filename.clone());
                let result = fetch_entry(&entry).await;
                (entry.filename.clone(), was_cached, result)
            }
        })
        .collect();
    drop(progress_tx);

    let mut report = FetchReport {
        total: tasks.len(),
        cached: 0,
        downloaded: 0,
        failures: Vec::new(),
    };

    while !tasks.is_empty() || !progress_rx.is_closed() {
        tokio::select! {
            Some(filename) = progress_rx.recv() => {
                on_progress(FetchProgress {
                    filename,
                    status: "downloading",
                    completed: report.cached + report.downloaded + report.failures.len(),
                    total: report.total,
                    cached: report.cached,
                    downloaded: report.downloaded,
                    failures: report.failures.len(),
                });
            }
            Some((filename, was_cached, result)) = tasks.next() => {
                let status = match result {
                    Ok(_) => {
                        if was_cached {
                            report.cached += 1;
                            "cached"
                        } else {
                            report.downloaded += 1;
                            "downloaded"
                        }
                    }
                    Err(e) => {
                        report.failures.push(format!("{filename}: {e}"));
                        "failed"
                    }
                };

                on_progress(FetchProgress {
                    filename,
                    status,
                    completed: report.cached + report.downloaded + report.failures.len(),
                    total: report.total,
                    cached: report.cached,
                    downloaded: report.downloaded,
                    failures: report.failures.len(),
                });
            }
            else => break,
        }
    }

    report
}
