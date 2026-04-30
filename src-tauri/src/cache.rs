//! Metadata-addressed on-disk cache.
//! Layout: `<data>/cache/<first-2-of-filename>/<filename>-<size>`.

use std::path::{Path, PathBuf};

use sha1::{Digest, Sha1};

use crate::paths;

pub fn path_for_entry(filename: &str, size: u64) -> anyhow::Result<PathBuf> {
    let safe_filename = sanitize_cache_filename(filename);
    if safe_filename.is_empty() {
        anyhow::bail!("empty cache filename");
    }
    let shard = safe_filename
        .chars()
        .take(2)
        .collect::<String>()
        .to_ascii_lowercase();
    let dir = paths::cache_dir()?.join(shard);
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("{safe_filename}-{size}")))
}

pub fn exists_with_size(filename: &str, size: u64) -> anyhow::Result<bool> {
    let path = path_for_entry(filename, size)?;
    if !path.exists() {
        return Ok(false);
    }
    Ok(path.metadata()?.len() == size)
}

pub fn file_sha1_hex(path: &Path) -> anyhow::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

fn sanitize_cache_filename(filename: &str) -> String {
    let mut out = String::with_capacity(filename.len());
    for byte in filename.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'.' | b'-' | b'_' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}
