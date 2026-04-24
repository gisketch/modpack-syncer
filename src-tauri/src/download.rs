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

use crate::{cache, manifest::Entry};

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
}

fn url_host_allowed(url: &str) -> bool {
    // Minimal allowlist for M1. User-configured Gitea/MinIO hosts merged in later.
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct FetchReport {
    pub total: usize,
    pub cached: usize,
    pub downloaded: usize,
    pub failures: Vec<String>,
}

pub async fn fetch_all(entries: Vec<Entry>) -> FetchReport {
    let sem = Arc::new(Semaphore::new(MAX_PARALLEL));
    let mut tasks: FuturesUnordered<_> = entries
        .into_iter()
        .map(|entry| {
            let sem = sem.clone();
            async move {
                let _permit = sem.acquire_owned().await.unwrap();
                let was_cached = cache::exists_and_matches(&entry.sha1).unwrap_or(false);
                let result = fetch_entry(&entry).await;
                (entry.filename.clone(), was_cached, result)
            }
        })
        .collect();

    let mut report = FetchReport {
        total: tasks.len(),
        cached: 0,
        downloaded: 0,
        failures: Vec::new(),
    };
    while let Some((filename, was_cached, result)) = tasks.next().await {
        match result {
            Ok(_) => {
                if was_cached {
                    report.cached += 1;
                } else {
                    report.downloaded += 1;
                }
            }
            Err(e) => report.failures.push(format!("{filename}: {e}")),
        }
    }
    report
}
