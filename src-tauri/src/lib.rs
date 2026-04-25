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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::packs::add_pack,
            commands::packs::list_packs,
            commands::packs::update_pack,
            commands::packs::load_manifest,
            commands::publish_auth::get_publish_auth_settings,
            commands::publish_auth::set_publish_auth_method,
            commands::publish_auth::save_publish_pat,
            commands::publish_auth::clear_publish_pat,
            commands::publish_auth::verify_publish_ssh,
            commands::prism_control::get_prism_settings,
            commands::prism_control::set_prism_settings,
            commands::packs::fetch_mods,
            commands::prism_control::detect_prism,
            commands::prism_control::get_prism_account_status,
            commands::prism_control::get_launch_profile,
            commands::prism_control::has_managed_java,
            commands::prism_control::clear_onboarding_settings,
            commands::prism_control::set_launch_profile,
            commands::prism_control::install_adoptium_java,
            commands::prism_control::install_managed_prism,
            commands::sync::sync_instance,
            commands::prism_control::launch_instance,
            commands::prism_control::launch_pack,
            commands::prism_control::get_instance_minecraft_dir,
            commands::changelog::pack_changelog,
            commands::publish::suggest_publish_version,
            commands::modrinth::preview_modrinth_mod,
            commands::modrinth::add_modrinth_mod,
            commands::modrinth::delete_instance_mod,
            commands::status::mod_statuses,
            commands::publish::scan_instance_publish,
            commands::sync::preview_options_sync,
            commands::sync::set_options_sync_ignored,
            commands::sync::preview_shader_settings_sync,
            commands::option_presets::list_option_presets,
            commands::option_presets::capture_option_preset,
            commands::option_presets::save_option_preset,
            commands::publish::apply_instance_publish,
            commands::publish::commit_and_push_publish,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
