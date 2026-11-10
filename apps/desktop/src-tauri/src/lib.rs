mod index_db;
mod vault;

use index_db::{
    backlinks, index_delete, index_open, index_pending_chunks, index_rename, index_set_vectors,
    index_upsert, reindex, search, search_hybrid, IndexState,
};
use vault::{
    plugin_list, plugin_read, plugin_write, vault_create_directory, vault_list, vault_read,
    vault_remove, vault_rename, vault_unwatch, vault_watch, vault_write, VaultWatch,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultWatch::default())
        .manage(IndexState::default())
        .invoke_handler(tauri::generate_handler![
            vault_list,
            vault_read,
            vault_write,
            vault_remove,
            vault_rename,
            vault_create_directory,
            vault_watch,
            vault_unwatch,
            plugin_read,
            plugin_write,
            plugin_list,
            index_open,
            index_upsert,
            index_delete,
            index_rename,
            search,
            search_hybrid,
            index_pending_chunks,
            index_set_vectors,
            backlinks,
            reindex
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
