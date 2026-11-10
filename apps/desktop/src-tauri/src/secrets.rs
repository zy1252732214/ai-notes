use keyring::{mock::MockCredential, Entry, Error};

const SERVICE: &str = "app.ai-notes.desktop";
const OPENAI: &str = "openai-api-key";
const OLLAMA: &str = "ollama-api-key";

fn known_account(account: &str) -> bool {
    account == OPENAI || account == OLLAMA
}

fn entry(account: &str) -> Result<Entry, String> {
    if !known_account(account) {
        return Err("未知的密钥项".into());
    }
    let entry = Entry::new(SERVICE, account).map_err(|err| err.to_string())?;
    if entry
        .get_credential()
        .downcast_ref::<MockCredential>()
        .is_some()
    {
        return Err("没有系统钥匙串".into());
    }
    Ok(entry)
}

fn read_password(entry: &Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

/// 当前平台的钥匙串能否读写。内存模拟或系统服务不可用时返回 false。
#[tauri::command]
pub fn secret_available() -> bool {
    let Ok(entry) = entry(OPENAI) else {
        return false;
    };
    read_password(&entry).is_ok()
}

#[tauri::command]
pub fn secret_get(account: String) -> Result<Option<String>, String> {
    read_password(&entry(&account)?)
}

#[tauri::command]
pub fn secret_set(account: String, secret: String) -> Result<(), String> {
    if secret.is_empty() {
        return secret_delete(account);
    }
    entry(&account)?
        .set_password(&secret)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn secret_delete(account: String) -> Result<(), String> {
    match entry(&account)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::secret_get;

    #[test]
    fn rejects_unknown_accounts() {
        let err = secret_get("notes".into()).expect_err("unknown account");
        assert!(err.contains("未知"));
        assert!(secret_get(String::new()).is_err());
    }
}
