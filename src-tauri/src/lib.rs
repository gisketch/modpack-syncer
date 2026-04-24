// gisketch//s_modpack_syncer — Tauri app entry
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
    format!("Hello, {}! gisketch//s_modpack_syncer Rust backend online.", name)
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::add_pack,
            commands::list_packs,
            commands::update_pack,
            commands::load_manifest,
            commands::get_publish_auth_settings,
            commands::set_publish_auth_method,
            commands::save_publish_pat,
            commands::clear_publish_pat,
            commands::verify_publish_ssh,
            commands::get_app_storage_settings,
            commands::set_app_storage_settings,
            commands::get_prism_settings,
            commands::set_prism_settings,
            commands::fetch_mods,
            commands::detect_prism,
            commands::get_prism_account_status,
            commands::get_launch_profile,
            commands::has_managed_java,
            commands::clear_onboarding_settings,
            commands::set_launch_profile,
            commands::install_adoptium_java,
            commands::install_managed_prism,
            commands::sync_instance,
            commands::launch_instance,
            commands::launch_pack,
            commands::get_instance_minecraft_dir,
            commands::pack_changelog,
            commands::suggest_publish_version,
            commands::preview_modrinth_mod,
            commands::add_modrinth_mod,
            commands::delete_instance_mod,
            commands::mod_statuses,
            commands::scan_instance_publish,
            commands::apply_instance_publish,
            commands::commit_and_push_publish,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
