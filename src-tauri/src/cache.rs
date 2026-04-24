//! Content-addressable on-disk cache.
//! Layout: `<data_dir>/cache/<sha1 first 2>/<sha1>.jar`.
//! Prefers reflink copy (btrfs/apfs) when available; falls back to hardlink, then copy.
//!
//! TODO(M1): `lookup`, `insert`, `link_into_instance`.

#![allow(dead_code)]
