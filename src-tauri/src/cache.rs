//! Content-addressable on-disk cache.
//! Layout: `<data>/cache/<first-2-of-sha1>/<sha1>`.

use std::path::{Path, PathBuf};

use sha1::{Digest, Sha1};

use crate::paths;

pub fn path_for(sha1_hex: &str) -> anyhow::Result<PathBuf> {
    if sha1_hex.len() < 4 {
        anyhow::bail!("sha1 too short");
    }
    let shard = &sha1_hex[..2];
    let dir = paths::cache_dir()?.join(shard);
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(sha1_hex))
}

pub fn exists_and_matches(sha1_hex: &str) -> anyhow::Result<bool> {
    let path = path_for(sha1_hex)?;
    if !path.exists() {
        return Ok(false);
    }
    Ok(file_sha1_hex(&path)? == sha1_hex.to_ascii_lowercase())
}

pub fn file_sha1_hex(path: &Path) -> anyhow::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}
