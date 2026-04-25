//! OS keychain wrapper for secrets (GitHub PAT).

use keyring::Entry;

const SERVICE: &str = "dev.gisketch.modsync";
const USERNAME: &str = "github-pat";

pub fn save_github_pat(token: &str) -> anyhow::Result<()> {
    let entry = Entry::new(SERVICE, USERNAME)?;
    entry.set_password(token)?;
    Ok(())
}

pub fn load_github_pat() -> anyhow::Result<Option<String>> {
    let entry = Entry::new(SERVICE, USERNAME)?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(err) if matches!(err, keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.into()),
    }
}

pub fn clear_github_pat() -> anyhow::Result<()> {
    let entry = Entry::new(SERVICE, USERNAME)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(err) if matches!(err, keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.into()),
    }
}
