use super::CommandError;
use crate::paths;

pub type InstallDirectorySettings = paths::InstallDirectorySettings;

#[tauri::command]
pub async fn get_install_directory() -> Result<InstallDirectorySettings, CommandError> {
    tokio::task::spawn_blocking(paths::install_directory_settings)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_install_directory(
    default_dir: Option<String>,
) -> Result<InstallDirectorySettings, CommandError> {
    tokio::task::spawn_blocking(move || paths::set_install_directory(default_dir))
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
        .map_err(CommandError::from)
}
