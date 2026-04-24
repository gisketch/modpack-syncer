import { invoke } from "@tauri-apps/api/core";

/**
 * Typed wrappers around Tauri commands exposed by the Rust backend.
 * Keep this file in sync with `src-tauri/src/lib.rs#invoke_handler`.
 */
export const tauri = {
  greet: (name: string) => invoke<string>("greet", { name }),
};
