use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
pub struct VaultEntry {
    path: String,
    kind: String,
}

pub struct VaultWatch {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for VaultWatch {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

fn canonical_root(root: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(root);
    if !path.is_dir() {
        return Err("笔记库文件夹不存在".into());
    }
    path.canonicalize().map_err(|err| err.to_string())
}

fn validate_rel(rel: &str) -> Result<String, String> {
    if rel.is_empty() || rel.contains('\0') {
        return Err("路径无效".into());
    }
    let normalized = rel.replace('\\', "/");
    if normalized.starts_with('/') || normalized.ends_with('/') {
        return Err("路径无效".into());
    }
    for segment in normalized.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." || segment.starts_with('.') {
            return Err("路径无效".into());
        }
    }
    Ok(normalized)
}

fn validate_ainotes(rel: &str) -> Result<String, String> {
    if rel.is_empty() || rel.contains('\0') {
        return Err("路径无效".into());
    }
    let normalized = rel.replace('\\', "/");
    if normalized.starts_with('/') || normalized.ends_with('/') || normalized.contains("//") {
        return Err("路径无效".into());
    }
    let mut segments = normalized.split('/');
    if segments.next() != Some(".ainotes") {
        return Err("只能访问 .ainotes".into());
    }
    for segment in segments {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("路径无效".into());
        }
    }
    Ok(normalized)
}

fn resolve_ainotes(root: &str, rel: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = canonical_root(root)?;
    let rel = validate_ainotes(rel)?;
    Ok((root.clone(), root.join(rel)))
}

fn resolve(root: &str, rel: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = canonical_root(root)?;
    let rel = validate_rel(rel)?;
    let target = root.join(&rel);
    if target.exists() {
        let canon = target.canonicalize().map_err(|err| err.to_string())?;
        if !canon.starts_with(&root) {
            return Err("路径超出笔记库".into());
        }
        return Ok((root, canon));
    }
    Ok((root, target))
}

fn ensure_inside(root: &Path, path: &Path) -> Result<(), String> {
    let canon = path.canonicalize().map_err(|err| err.to_string())?;
    if canon.starts_with(root) {
        Ok(())
    } else {
        Err("路径超出笔记库".into())
    }
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
}

fn relative_path(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let text = rel.to_string_lossy().replace('\\', "/");
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<VaultEntry>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|err| err.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        let file_type = entry.file_type().map_err(|err| err.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let Some(rel) = relative_path(root, &path) else {
            continue;
        };
        if file_type.is_dir() {
            out.push(VaultEntry {
                path: rel,
                kind: "directory".into(),
            });
            walk(root, &path, out)?;
        } else if is_markdown(&path) {
            out.push(VaultEntry {
                path: rel,
                kind: "file".into(),
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn vault_list(root: String) -> Result<Vec<VaultEntry>, String> {
    let root = canonical_root(&root)?;
    let mut entries = Vec::new();
    walk(&root, &root, &mut entries)?;
    Ok(entries)
}

#[tauri::command]
pub fn vault_read(root: String, path: String) -> Result<String, String> {
    let (_root, target) = resolve(&root, &path)?;
    std::fs::read_to_string(target).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn vault_write(root: String, path: String, contents: String) -> Result<(), String> {
    let (root_path, target) = resolve(&root, &path)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        ensure_inside(&root_path, parent)?;
    }
    std::fs::write(&target, contents).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn vault_create_directory(root: String, path: String) -> Result<(), String> {
    let (root_path, target) = resolve(&root, &path)?;
    if target.exists() {
        return Err("目标已存在".into());
    }
    std::fs::create_dir_all(&target).map_err(|err| err.to_string())?;
    ensure_inside(&root_path, &target)
}

#[tauri::command]
pub fn vault_remove(root: String, path: String) -> Result<(), String> {
    let (_root, target) = resolve(&root, &path)?;
    if target.is_dir() {
        std::fs::remove_dir_all(target).map_err(|err| err.to_string())
    } else {
        std::fs::remove_file(target).map_err(|err| err.to_string())
    }
}

#[tauri::command]
pub fn vault_rename(root: String, from: String, to: String) -> Result<(), String> {
    let (root_path, source) = resolve(&root, &from)?;
    if !source.exists() {
        return Err("找不到要重命名的项目".into());
    }
    let (_root, target) = resolve(&root, &to)?;
    if target.exists() {
        return Err("目标已存在".into());
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        ensure_inside(&root_path, parent)?;
    }
    std::fs::rename(source, target).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn plugin_read(root: String, path: String) -> Result<Option<String>, String> {
    let (_root, target) = resolve_ainotes(&root, &path)?;
    if !target.exists() {
        return Ok(None);
    }
    if !target.is_file() {
        return Err("不是文件".into());
    }
    std::fs::read_to_string(target).map(Some).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn plugin_write(root: String, path: String, contents: String) -> Result<(), String> {
    let (root_path, target) = resolve_ainotes(&root, &path)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        if parent.exists() {
            ensure_inside(&root_path, parent)?;
        }
    }
    std::fs::write(target, contents).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn plugin_list(root: String, path: String) -> Result<Vec<String>, String> {
    let (_root, target) = resolve_ainotes(&root, &path)?;
    if !target.exists() {
        return Ok(Vec::new());
    }
    if !target.is_dir() {
        return Err("不是目录".into());
    }
    let mut names = Vec::new();
    for entry in std::fs::read_dir(&target).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.file_type().map(|kind| kind.is_symlink()).unwrap_or(true) {
            continue;
        }
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
pub fn vault_watch(app: AppHandle, state: State<'_, VaultWatch>, root: String) -> Result<(), String> {
    let root_path = canonical_root(&root)?;
    let emit_root = root_path.clone();
    let mut watcher = notify::recommended_watcher(move |result: Result<notify::Event, notify::Error>| {
        let Ok(event) = result else {
            return;
        };
        if matches!(event.kind, EventKind::Access(_) | EventKind::Other) {
            return;
        }
        let paths: Vec<String> = event
            .paths
            .iter()
            .filter_map(|path| relative_path(&emit_root, path))
            .filter(|path| !path.split('/').any(|segment| segment.starts_with('.')))
            .collect();
        if paths.is_empty() && !event.paths.is_empty() {
            return;
        }
        let _ = app.emit("vault-changed", serde_json::json!({ "paths": paths }));
    })
    .map_err(|err| err.to_string())?;

    watcher
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|err| err.to_string())?;

    let mut slot = state.watcher.lock().map_err(|err| err.to_string())?;
    *slot = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn vault_unwatch(state: State<'_, VaultWatch>) -> Result<(), String> {
    let mut slot = state.watcher.lock().map_err(|err| err.to_string())?;
    *slot = None;
    Ok(())
}
