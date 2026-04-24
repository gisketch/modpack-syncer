//! Embedded git client via libgit2 (`git2` crate, vendored).
//! Handles: clone, fetch, pull, diff, commit, push.
//! No system git required.
//!
//! TODO(M0): `clone_pack`, `fetch_updates`, `head_sha`.
//! TODO(M4): `stage`, `commit`, `push` (author mode).

#![allow(dead_code)]

use std::path::Path;

pub fn clone_pack(_url: &str, _dest: &Path) -> anyhow::Result<()> {
    // TODO: git2::Repository::clone with auth callback (PAT from keychain)
    anyhow::bail!("not implemented")
}
