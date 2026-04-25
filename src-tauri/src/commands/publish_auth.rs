use super::{CommandError, PublishAuthSettings, PublishSshStatus};
use crate::{git, paths};

#[tauri::command]
pub async fn get_publish_auth_settings() -> Result<PublishAuthSettings, CommandError> {
    let path = paths::publish_auth_path()?;
    let method = if path.exists() {
        let bytes = std::fs::read(path)?;
        serde_json::from_slice::<PublishAuthSettings>(&bytes)
            .ok()
            .and_then(|settings| settings.method)
    } else {
        None
    };
    Ok(PublishAuthSettings {
        method,
        has_pat: crate::keychain::load_github_pat()?.is_some(),
    })
}

#[tauri::command]
pub async fn set_publish_auth_method(
    method: Option<String>,
) -> Result<PublishAuthSettings, CommandError> {
    let path = paths::publish_auth_path()?;
    let settings = PublishAuthSettings {
        method,
        has_pat: crate::keychain::load_github_pat()?.is_some(),
    };
    let bytes = serde_json::to_vec_pretty(&settings).map_err(anyhow::Error::from)?;
    std::fs::write(&path, bytes)?;
    Ok(settings)
}

#[tauri::command]
pub async fn save_publish_pat(token: String) -> Result<PublishAuthSettings, CommandError> {
    crate::keychain::save_github_pat(&token)?;
    let method = get_publish_auth_settings().await?.method;
    Ok(PublishAuthSettings {
        method,
        has_pat: true,
    })
}

#[tauri::command]
pub async fn clear_publish_pat() -> Result<PublishAuthSettings, CommandError> {
    crate::keychain::clear_github_pat()?;
    let method = get_publish_auth_settings().await?.method;
    Ok(PublishAuthSettings {
        method,
        has_pat: false,
    })
}

#[tauri::command]
pub async fn verify_publish_ssh() -> Result<PublishSshStatus, CommandError> {
    match tokio::task::spawn_blocking(git::verify_ssh_access)
        .await
        .map_err(|e| CommandError::Other(e.to_string()))?
    {
        Ok(access) => Ok(PublishSshStatus {
            verified: true,
            source: Some(access.source),
        }),
        Err(err) => Err(CommandError::Git(err.to_string())),
    }
}
