// modsync — Tauri app entry
// Module skeletons for the core subsystems. Each module will grow over milestones (M0-M6).
// See docs/architecture.md.

mod cache;
mod db;
mod download;
mod git;
mod keychain;
mod manifest;
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
