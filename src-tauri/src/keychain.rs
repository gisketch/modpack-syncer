//! OS keychain wrapper for secrets (Gitea PAT, MinIO access keys).
//! Uses the `keyring` crate.
//!
//! TODO(M0): `get`, `set`, `delete` with service = "dev.gisketch.modsync".

#![allow(dead_code)]
