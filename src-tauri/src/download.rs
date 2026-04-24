//! Parallel HTTP download pipeline with resume + SHA verify.
//! Uses reqwest + tokio Semaphore.
//!
//! TODO(M1): implement `download_entry` with Range resume + sha1/sha512 check.

#![allow(dead_code)]

use crate::manifest::Entry;

pub async fn download_entry(_entry: &Entry, _dest_dir: &std::path::Path) -> anyhow::Result<()> {
    anyhow::bail!("not implemented")
}
