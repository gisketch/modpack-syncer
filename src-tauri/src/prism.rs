//! Prism Launcher integration.
//! - Detect install path.
//! - Write `instances/<name>/{instance.cfg, mmc-pack.json, .minecraft/...}`.
//! - Spawn `prismlauncher --launch <name>`.
//!
//! TODO(M1): `detect_prism`, `write_instance`, `launch`.

#![allow(dead_code)]

use std::path::PathBuf;

pub fn detect_prism() -> Option<PathBuf> {
    // TODO: check $MODSYNC_PRISM_PATH, platform defaults, then PATH.
    None
}
