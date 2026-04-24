// modsync — Tauri app entry
// Module skeletons for the core subsystems. Each module will grow over milestones (M0-M6).
// See docs/architecture.md.

mod cache;
mod commands;
mod db;
mod download;
mod git;
mod keychain;
mod manifest;
mod paths;
mod prism;
mod profile;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! modsync Rust backend online.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::add_pack,
            commands::list_packs,
            commands::load_manifest,
            commands::fetch_mods,
            commands::detect_prism,
            commands::sync_instance,
            commands::launch_instance,
            commands::mod_statuses,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
