//! Local SQLite store for cache index, pack state, settings.
//! Pool: r2d2 + r2d2_sqlite.
//!
//! TODO(M0): `open`, migrations (v1).

#![allow(dead_code)]
