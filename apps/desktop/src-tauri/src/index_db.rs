use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use tauri::State;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  frontmatter TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  heading_path TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  text TEXT NOT NULL,
  ordinal INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_note_id ON chunks(note_id);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  heading_path,
  title,
  tokenize = "unicode61 remove_diacritics 2"
);
CREATE TABLE IF NOT EXISTS links (
  src_note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  dst_path TEXT NOT NULL,
  dst_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wikilink', 'markdown', 'embed', 'block')),
  PRIMARY KEY (src_note_id, dst_path, kind)
);
CREATE INDEX IF NOT EXISTS idx_links_dst_note ON links(dst_note_id);
CREATE INDEX IF NOT EXISTS idx_links_dst_path ON links(dst_path);
"#;

struct OpenIndex {
    root: PathBuf,
    conn: Connection,
}

pub struct IndexState {
    inner: Mutex<Option<OpenIndex>>,
}

impl Default for IndexState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    note_id: i64,
    path: String,
    title: String,
    chunk_id: i64,
    heading_path: String,
    start: i64,
    end: i64,
    text: String,
    snippet: String,
    score: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backlink {
    path: String,
    title: String,
    kind: String,
    dst_path: String,
}

#[tauri::command]
pub fn index_open(state: State<'_, IndexState>, root: String) -> Result<(), String> {
    let root_path = canonicalize_dir(&root)?;
    let directory = root_path.join(".ainotes");
    fs::create_dir_all(&directory).map_err(|err| err.to_string())?;
    let conn = Connection::open(directory.join("index.db")).map_err(|err| err.to_string())?;
    prepare(&conn)?;
    let mut slot = state.inner.lock().map_err(|err| err.to_string())?;
    *slot = Some(OpenIndex {
        root: root_path,
        conn,
    });
    Ok(())
}

#[tauri::command]
pub fn index_upsert(state: State<'_, IndexState>, path: String, content: String) -> Result<(), String> {
    with_conn(&state, |conn, _root| upsert(conn, &path, &content, now_ms()))
}

#[tauri::command]
pub fn index_delete(state: State<'_, IndexState>, path: String) -> Result<(), String> {
    with_conn(&state, |conn, _root| {
        delete_path(conn, &path);
        Ok(())
    })
}

#[tauri::command]
pub fn index_rename(state: State<'_, IndexState>, from: String, to: String) -> Result<(), String> {
    with_conn(&state, |conn, _root| {
        rename_path(conn, &from, &to);
        Ok(())
    })
}

#[tauri::command]
pub fn search(state: State<'_, IndexState>, query: String, limit: u32) -> Result<Vec<SearchHit>, String> {
    with_conn(&state, |conn, _root| search_notes(conn, &query, limit))
}

#[tauri::command]
pub fn backlinks(state: State<'_, IndexState>, path: String) -> Result<Vec<Backlink>, String> {
    with_conn(&state, |conn, _root| Ok(backlinks_for(conn, &path)))
}

#[tauri::command]
pub fn reindex(state: State<'_, IndexState>) -> Result<(), String> {
    with_conn(&state, |conn, root| rebuild(conn, root))
}

fn with_conn<T>(
    state: &State<'_, IndexState>,
    run: impl FnOnce(&Connection, &Path) -> Result<T, String>,
) -> Result<T, String> {
    let slot = state.inner.lock().map_err(|err| err.to_string())?;
    let open = slot.as_ref().ok_or("还没有打开笔记库索引")?;
    run(&open.conn, &open.root)
}

fn prepare(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|err| err.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|err| err.to_string())
}

fn upsert(conn: &Connection, path: &str, content: &str, mtime: i64) -> Result<(), String> {
    let path = normalize_path(path)?;
    let hash = fingerprint(content);
    let tx = conn.unchecked_transaction().map_err(|err| err.to_string())?;
    let existing: Option<(i64, String)> = tx
        .query_row(
            "SELECT id, hash FROM notes WHERE path = ?1",
            [&path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|err| err.to_string())?;
    let note_id = if let Some((id, old_hash)) = existing {
        if old_hash == hash {
            tx.execute("UPDATE notes SET mtime = ?1 WHERE id = ?2", params![mtime, id])
                .map_err(|err| err.to_string())?;
            resolve_links(&tx)?;
            tx.commit().map_err(|err| err.to_string())?;
            return Ok(());
        }
        clear_chunks(&tx, id)?;
        let title = extract_title(&path, content);
        tx.execute(
            "UPDATE notes SET title = ?1, hash = ?2, mtime = ?3, updated_at = ?4 WHERE id = ?5",
            params![title, hash, mtime, mtime, id],
        )
        .map_err(|err| err.to_string())?;
        id
    } else {
        let title = extract_title(&path, content);
        tx.execute(
            "INSERT INTO notes(path, title, hash, mtime, created_at, updated_at, frontmatter) VALUES (?1, ?2, ?3, ?4, ?5, ?5, '{}')",
            params![path, title, hash, mtime, mtime],
        )
        .map_err(|err| err.to_string())?;
        tx.last_insert_rowid()
    };
    let title = extract_title(&path, content);
    insert_chunks(&tx, note_id, &title, content)?;
    replace_links(&tx, note_id, content)?;
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

fn delete_path(conn: &Connection, path: &str) {
    let Ok(path) = normalize_path(path) else {
        return;
    };
    let Ok(tx) = conn.unchecked_transaction() else {
        return;
    };
    let paths = note_paths(&tx);
    for note_path in paths {
        if note_path == path || note_path.starts_with(&(path.clone() + "/")) {
            if let Ok(id) = tx.query_row("SELECT id FROM notes WHERE path = ?1", [&note_path], |row| row.get(0)) {
                let _ = clear_chunks(&tx, id);
                let _ = tx.execute("DELETE FROM notes WHERE id = ?1", [id]);
            }
        }
    }
    let _ = resolve_links(&tx);
    let _ = tx.commit();
}

fn rename_path(conn: &Connection, from: &str, to: &str) {
    let Ok(from) = normalize_path(from) else {
        return;
    };
    let Ok(to) = normalize_path(to) else {
        return;
    };
    if from == to {
        return;
    }
    let Ok(tx) = conn.unchecked_transaction() else {
        return;
    };
    let notes = note_paths(&tx);
    for path in notes {
        let next = remap(&path, &from, &to);
        if next != path {
            let _ = tx.execute("UPDATE notes SET path = ?1 WHERE path = ?2", params![next, path]);
        }
    }
    let mut statement = match tx.prepare("SELECT src_note_id, dst_path, kind FROM links") {
        Ok(statement) => statement,
        Err(_) => return,
    };
    let rows: Vec<(i64, String, String)> = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map(|iter| iter.filter_map(Result::ok).collect())
        .unwrap_or_default();
    drop(statement);
    for (src, dst, kind) in rows {
        let next = remap(&dst, &from, &to);
        if next == dst {
            continue;
        }
        let _ = tx.execute(
            "DELETE FROM links WHERE src_note_id = ?1 AND dst_path = ?2 AND kind = ?3",
            params![src, dst, kind],
        );
        let _ = tx.execute(
            "INSERT INTO links(src_note_id, dst_path, dst_note_id, kind) VALUES (?1, ?2, NULL, ?3) ON CONFLICT(src_note_id, dst_path, kind) DO NOTHING",
            params![src, next, kind],
        );
    }
    let _ = resolve_links(&tx);
    let _ = tx.commit();
}

fn search_notes(conn: &Connection, query: &str, limit: u32) -> Result<Vec<SearchHit>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let limit = limit.clamp(1, 100);
    let fts = to_fts_query(query);
    let sql = r#"
      SELECT c.id, c.note_id, c.heading_path, c.start, c."end", c.text, n.path, n.title, -bm25(chunks_fts)
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN notes n ON n.id = c.note_id
      WHERE chunks_fts MATCH ?1
      ORDER BY bm25(chunks_fts), c.ordinal
      LIMIT ?2
    "#;
    let mut hits = Vec::new();
    if let Ok(mut statement) = conn.prepare(sql) {
        if let Ok(rows) = statement.query_map(params![fts, limit], |row| {
            let text: String = row.get(5)?;
            let heading: String = row.get(2)?;
            let title: String = row.get(7)?;
            Ok(SearchHit {
                chunk_id: row.get(0)?,
                note_id: row.get(1)?,
                heading_path: heading.clone(),
                start: row.get(3)?,
                end: row.get(4)?,
                text: text.clone(),
                path: row.get(6)?,
                title: title.clone(),
                snippet: snippet(&text, &heading, &title, query),
                score: row.get(8)?,
            })
        }) {
            for hit in rows.flatten() {
                hits.push(hit);
            }
            if !hits.is_empty() {
                return Ok(hits);
            }
        }
    }
    let pattern = format!("%{}%", query.replace('%', "").replace('_', ""));
    let mut statement = conn
        .prepare(
            r#"SELECT c.id, c.note_id, c.heading_path, c.start, c."end", c.text, n.path, n.title
               FROM chunks c JOIN notes n ON n.id = c.note_id
               WHERE c.text LIKE ?1 OR n.title LIKE ?1 OR c.heading_path LIKE ?1
               LIMIT ?2"#,
        )
        .map_err(|err| err.to_string())?;
    let rows = statement
        .query_map(params![pattern, limit], |row| {
            let text: String = row.get(5)?;
            let heading: String = row.get(2)?;
            let title: String = row.get(7)?;
            Ok(SearchHit {
                chunk_id: row.get(0)?,
                note_id: row.get(1)?,
                heading_path: heading.clone(),
                start: row.get(3)?,
                end: row.get(4)?,
                text: text.clone(),
                path: row.get(6)?,
                title: title.clone(),
                snippet: snippet(&text, &heading, &title, query),
                score: 1.0,
            })
        })
        .map_err(|err| err.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

fn backlinks_for(conn: &Connection, path: &str) -> Vec<Backlink> {
    let Ok(path) = normalize_path(path) else {
        return Vec::new();
    };
    let notes = note_paths(conn);
    let basename = path.rsplit('/').next().unwrap_or(&path).to_string();
    let same_name = notes
        .iter()
        .filter(|note| *note == &basename || note.ends_with(&format!("/{basename}")))
        .count();
    let note_id: Option<i64> = conn
        .query_row("SELECT id FROM notes WHERE path = ?1", [&path], |row| row.get(0))
        .optional()
        .ok()
        .flatten();
    let mut statement = match conn.prepare(
        r#"SELECT n.path, n.title, l.kind, l.dst_path, l.dst_note_id
           FROM links l JOIN notes n ON n.id = l.src_note_id
           ORDER BY n.path, l.kind"#,
    ) {
        Ok(statement) => statement,
        Err(_) => return Vec::new(),
    };
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<i64>>(4)?,
            ))
        })
        .map(|iter| iter.filter_map(Result::ok).collect::<Vec<_>>())
        .unwrap_or_default();
    rows.into_iter()
        .filter(|(_, _, _, dst, dst_id)| {
            if note_id.is_some() && *dst_id == note_id {
                return true;
            }
            if dst == &path {
                return true;
            }
            dst == &basename && same_name == 1
        })
        .map(|(path, title, kind, dst_path, _)| Backlink {
            path,
            title,
            kind,
            dst_path,
        })
        .collect()
}

fn rebuild(conn: &Connection, root: &Path) -> Result<(), String> {
    let mut files = Vec::new();
    collect_markdown(root, root, &mut files)?;
    let tx = conn.unchecked_transaction().map_err(|err| err.to_string())?;
    let existing = note_paths(&tx);
    for path in existing {
        if !files.iter().any(|(note_path, _)| note_path == &path) {
            if let Ok(id) = tx.query_row("SELECT id FROM notes WHERE path = ?1", [&path], |row| row.get::<_, i64>(0)) {
                let _ = clear_chunks(&tx, id);
                let _ = tx.execute("DELETE FROM notes WHERE id = ?1", [id]);
            }
        }
    }
    for (path, content) in &files {
        let mtime = fs::metadata(root.join(path))
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or_else(now_ms);
        // Commit per note would be simpler, but we are inside a transaction.
        // Drop this transaction and upsert outside to reuse upsert's own transaction.
        let _ = (content, mtime);
    }
    tx.commit().map_err(|err| err.to_string())?;
    for (path, content) in files {
        let mtime = fs::metadata(root.join(&path))
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or_else(now_ms);
        upsert(conn, &path, &content, mtime)?;
    }
    Ok(())
}

fn insert_chunks(conn: &Connection, note_id: i64, title: &str, content: &str) -> Result<(), String> {
    for (ordinal, chunk) in chunk_markdown(content).into_iter().enumerate() {
        conn.execute(
            r#"INSERT INTO chunks(note_id, heading_path, start, "end", text, ordinal) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
            params![note_id, chunk.heading, chunk.start, chunk.end, chunk.text, ordinal as i64],
        )
        .map_err(|err| err.to_string())?;
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO chunks_fts(rowid, text, heading_path, title) VALUES (?1, ?2, ?3, ?4)",
            params![id, segment(&chunk.text), segment(&chunk.heading), segment(title)],
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn clear_chunks(conn: &Connection, note_id: i64) -> Result<(), String> {
    let mut statement = conn
        .prepare("SELECT id FROM chunks WHERE note_id = ?1")
        .map_err(|err| err.to_string())?;
    let ids: Vec<i64> = statement
        .query_map([note_id], |row| row.get(0))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    drop(statement);
    for id in ids {
        conn.execute("DELETE FROM chunks_fts WHERE rowid = ?1", [id])
            .map_err(|err| err.to_string())?;
    }
    conn.execute("DELETE FROM chunks WHERE note_id = ?1", [note_id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn replace_links(conn: &Connection, note_id: i64, content: &str) -> Result<(), String> {
    conn.execute("DELETE FROM links WHERE src_note_id = ?1", [note_id])
        .map_err(|err| err.to_string())?;
    for (kind, dst) in extract_links(content) {
        conn.execute(
            "INSERT INTO links(src_note_id, dst_path, dst_note_id, kind) VALUES (?1, ?2, NULL, ?3) ON CONFLICT(src_note_id, dst_path, kind) DO NOTHING",
            params![note_id, dst, kind],
        )
        .map_err(|err| err.to_string())?;
    }
    resolve_links(conn)
}

fn resolve_links(conn: &Connection) -> Result<(), String> {
    let notes = note_refs(conn);
    let mut statement = conn
        .prepare("SELECT src_note_id, dst_path, kind, dst_note_id FROM links")
        .map_err(|err| err.to_string())?;
    let links: Vec<(i64, String, String, Option<i64>)> = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    drop(statement);
    for (src, dst, kind, current) in links {
        let resolved = resolve_destination(&dst, &notes);
        if current == resolved {
            continue;
        }
        conn.execute(
            "UPDATE links SET dst_note_id = ?1 WHERE src_note_id = ?2 AND dst_path = ?3 AND kind = ?4",
            params![resolved, src, dst, kind],
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

struct Chunk {
    heading: String,
    start: i64,
    end: i64,
    text: String,
}

fn chunk_markdown(content: &str) -> Vec<Chunk> {
    let chars: Vec<char> = content.chars().collect();
    let mut lines = Vec::new();
    let mut start = 0usize;
    for (index, ch) in chars.iter().enumerate() {
        if *ch == '\n' {
            lines.push((start, index, chars[start..index].iter().collect::<String>()));
            start = index + 1;
        }
    }
    if start <= chars.len() {
        lines.push((start, chars.len(), chars[start..].iter().collect::<String>()));
    }
    let mut fence: Option<(char, usize)> = None;
    let mut sections: Vec<(String, usize, usize)> = Vec::new();
    let mut heading = String::new();
    let mut section_start = 0usize;
    let mut stack: Vec<(usize, String)> = Vec::new();
    for (line_start, _line_end, line) in &lines {
        let trimmed = line.trim_end_matches('\r');
        if let Some((mark, len)) = fence {
            if trimmed.trim().starts_with(mark) && trimmed.trim().chars().filter(|ch| *ch == mark).count() >= len && trimmed.trim().chars().all(|ch| ch == mark) {
                fence = None;
            }
            continue;
        }
        if let Some((mark, len)) = opening_fence(trimmed) {
            fence = Some((mark, len));
            continue;
        }
        if let Some((level, title)) = heading_of(trimmed) {
            if *line_start > section_start {
                sections.push((heading.clone(), section_start, *line_start));
            }
            stack.retain(|(existing, _)| *existing < level);
            stack.push((level, title));
            heading = stack.iter().map(|(_, title)| title.as_str()).collect::<Vec<_>>().join(" / ");
            section_start = *line_start;
        }
    }
    if section_start < chars.len() || sections.is_empty() {
        sections.push((heading, section_start, chars.len()));
    }
    let mut chunks = Vec::new();
    for (heading, start, end) in sections {
        if end <= start {
            continue;
        }
        let text: String = chars[start..end].iter().collect();
        if text.trim().is_empty() {
            continue;
        }
        if text.chars().count() <= 500 {
            chunks.push(Chunk {
                heading,
                start: start as i64,
                end: end as i64,
                text,
            });
            continue;
        }
        let mut cursor = start;
        while cursor < end {
            let mut chunk_end = (cursor + 500).min(end);
            if chunk_end < end {
                if let Some(break_at) = chars[cursor..chunk_end].iter().rposition(|ch| *ch == '\n') {
                    if break_at > (chunk_end - cursor) / 2 {
                        chunk_end = cursor + break_at;
                    }
                }
            }
            if chunk_end <= cursor {
                chunk_end = (cursor + 500).min(end);
            }
            let text: String = chars[cursor..chunk_end].iter().collect();
            if !text.trim().is_empty() {
                chunks.push(Chunk {
                    heading: heading.clone(),
                    start: cursor as i64,
                    end: chunk_end as i64,
                    text,
                });
            }
            if chunk_end >= end {
                break;
            }
            let next = chunk_end.saturating_sub(50);
            cursor = if next > cursor { next } else { chunk_end };
        }
    }
    chunks
}

fn opening_fence(line: &str) -> Option<(char, usize)> {
    let trimmed = line.trim_start();
    let mark = trimmed.chars().next()?;
    if mark != '`' && mark != '~' {
        return None;
    }
    let len = trimmed.chars().take_while(|ch| *ch == mark).count();
    if len >= 3 { Some((mark, len)) } else { None }
}

fn heading_of(line: &str) -> Option<(usize, String)> {
    let hashes = line.chars().take_while(|ch| *ch == '#').count();
    if !(1..=6).contains(&hashes) {
        return None;
    }
    let rest = line[hashes..].trim();
    let Some(marker) = line.as_bytes().get(hashes).copied() else {
        return None;
    };
    if rest.is_empty() || marker == b'#' || (marker != b' ' && marker != b'\t') {
        return None;
    }
    Some((hashes, rest.trim_end_matches('#').trim().to_string()))
}

fn extract_links(content: &str) -> Vec<(String, String)> {
    let masked = mask_code(content);
    let mut found = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for cap in wiki_regex().captures_iter(&masked) {
        let embed = cap.get(1).map(|item| item.as_str()) == Some("!");
        let body = cap.get(2).map(|item| item.as_str()).unwrap_or("");
        let Some((kind, path)) = parse_wiki(embed, body) else {
            continue;
        };
        let key = format!("{kind}\0{path}");
        if seen.insert(key) {
            found.push((kind, path));
        }
    }
    found
}

fn parse_wiki(embed: bool, body: &str) -> Option<(String, String)> {
    let target = body.split('|').next()?.trim();
    let anchor = target.split_once('#').map(|(_, anchor)| anchor).unwrap_or("");
    let path = wikilink_to_path(target)?;
    let kind = if embed {
        "embed"
    } else if anchor.starts_with('^') {
        "block"
    } else {
        "wikilink"
    };
    Some((kind.to_string(), path))
}

fn wikilink_to_path(raw: &str) -> Option<String> {
    let mut target = raw.split('#').next()?.trim().replace('\\', "/");
    target = target.trim_start_matches("./").trim_start_matches('/').to_string();
    if target.is_empty() || target.split('/').any(|part| part.is_empty() || part == "." || part == "..") {
        return None;
    }
    if !target.to_lowercase().ends_with(".md") {
        target.push_str(".md");
    }
    Some(target)
}

fn mask_code(content: &str) -> String {
    let mut out = String::new();
    let mut fence: Option<(char, usize)> = None;
    for line in content.split_inclusive('\n') {
        let bare = line.trim_end_matches(['\n', '\r']);
        if let Some((mark, len)) = fence {
            let trimmed = bare.trim();
            let closed = trimmed.starts_with(mark)
                && trimmed.chars().all(|ch| ch == mark)
                && trimmed.chars().count() >= len;
            out.push_str(&" ".repeat(bare.chars().count()));
            if closed {
                fence = None;
            }
        } else if let Some(opened) = opening_fence(bare) {
            fence = Some(opened);
            out.push_str(bare);
        } else {
            out.push_str(&blank_inline(bare));
        }
        if line.ends_with('\n') {
            out.push('\n');
        }
    }
    out
}

fn blank_inline(line: &str) -> String {
    let mut chars: Vec<char> = line.chars().collect();
    let mut open = None;
    for (index, ch) in chars.clone().into_iter().enumerate() {
        if ch != '`' {
            continue;
        }
        if let Some(start) = open {
            for item in chars.iter_mut().take(index + 1).skip(start) {
                *item = ' ';
            }
            open = None;
        } else {
            open = Some(index);
        }
    }
    chars.into_iter().collect()
}

fn wiki_regex() -> &'static Regex {
    static WIKI: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(!?)\[\[([^\]\n]+?)\]\]").unwrap());
    &WIKI
}

fn resolve_destination(dst: &str, notes: &[(i64, String)]) -> Option<i64> {
    if let Some((id, _)) = notes.iter().find(|(_, path)| path == dst) {
        return Some(*id);
    }
    if dst.contains('/') {
        return None;
    }
    let matches: Vec<_> = notes
        .iter()
        .filter(|(_, path)| path.rsplit('/').next() == Some(dst))
        .collect();
    matches.first().map(|(id, _)| *id)
}

fn note_refs(conn: &Connection) -> Vec<(i64, String)> {
    let Ok(mut statement) = conn.prepare("SELECT id, path FROM notes") else {
        return Vec::new();
    };
    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map(|iter| iter.filter_map(Result::ok).collect())
        .unwrap_or_default()
}

fn note_paths(conn: &Connection) -> Vec<String> {
    note_refs(conn).into_iter().map(|(_, path)| path).collect()
}

fn extract_title(path: &str, content: &str) -> String {
    for line in content.lines() {
        if let Some((_, title)) = heading_of(line.trim_end_matches('\r')) {
            if !title.is_empty() {
                return title;
            }
        }
    }
    path.rsplit('/').next().unwrap_or(path).trim_end_matches(".md").to_string()
}

fn segment(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if is_cjk(ch) {
            if !out.is_empty() && !out.ends_with(' ') {
                out.push(' ');
            }
            out.push(ch);
            out.push(' ');
        } else {
            out.push(ch);
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch,
        '\u{4E00}'..='\u{9FFF}'
            | '\u{3400}'..='\u{4DBF}'
            | '\u{3040}'..='\u{30FF}'
            | '\u{AC00}'..='\u{D7AF}'
    )
}

fn to_fts_query(query: &str) -> String {
    let segmented = segment(query);
    format!("\"{}\"", segmented.replace('"', "\"\""))
}

fn snippet(text: &str, heading: &str, title: &str, query: &str) -> String {
    for source in [text, heading, title] {
        if let Some(hit) = highlight(source, query) {
            return hit;
        }
    }
    highlight(text, query).unwrap_or_else(|| text.chars().take(64).collect())
}

fn highlight(text: &str, query: &str) -> Option<String> {
    let index = text.to_lowercase().find(&query.to_lowercase())?;
    let end = index + query.len();
    if text.is_char_boundary(index) && text.is_char_boundary(end.min(text.len())) && end <= text.len() {
        let start = index.saturating_sub(32);
        let start = (start..=index).rev().find(|point| text.is_char_boundary(*point)).unwrap_or(index);
        let stop = (end + 32).min(text.len());
        let stop = (end..=stop).rev().find(|point| text.is_char_boundary(*point)).unwrap_or(end);
        let prefix = if start > 0 { "…" } else { "" };
        let suffix = if stop < text.len() { "…" } else { "" };
        return Some(format!("{prefix}{}<b>{}</b>{}{suffix}", &text[start..index], &text[index..end], &text[end..stop]));
    }
    None
}

fn remap(path: &str, from: &str, to: &str) -> String {
    if path == from {
        to.to_string()
    } else if let Some(rest) = path.strip_prefix(&(from.to_string() + "/")) {
        format!("{to}/{rest}")
    } else {
        path.to_string()
    }
}

fn normalize_path(path: &str) -> Result<String, String> {
    let parts: Vec<_> = path
        .replace('\\', "/")
        .split('/')
        .filter(|part| !part.is_empty() && *part != ".")
        .map(str::to_string)
        .collect();
    if parts.is_empty() || parts.iter().any(|part| part == "..") {
        return Err(format!("Invalid note path: {path}"));
    }
    Ok(parts.join("/"))
}

fn fingerprint(content: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in content.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}:{}", content.len())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn canonicalize_dir(root: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(root);
    if !path.is_dir() {
        return Err("笔记库文件夹不存在".into());
    }
    path.canonicalize().map_err(|err| err.to_string())
}

fn collect_markdown(root: &Path, dir: &Path, out: &mut Vec<(String, String)>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_markdown(root, &path, out)?;
        } else if path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case("md")) {
            let rel = path.strip_prefix(root).map_err(|err| err.to_string())?;
            let rel = rel.to_string_lossy().replace('\\', "/");
            let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
            out.push((rel, content));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        prepare(&conn).unwrap();
        conn
    }

    #[test]
    fn incremental_backlinks_and_search() {
        let conn = memory();
        upsert(&conn, "欢迎.md", "# 欢迎\n\n相关笔记：[[周报]]、[[项目/计划]]\n", 1).unwrap();
        upsert(&conn, "日常/周报.md", "# 周报\n\n全文检索会索引这一段。\n", 1).unwrap();
        upsert(&conn, "项目/计划.md", "# 计划\n\n见 [[欢迎]]。\n", 1).unwrap();
        let weekly = backlinks_for(&conn, "日常/周报.md");
        assert_eq!(weekly.len(), 1);
        assert_eq!(weekly[0].path, "欢迎.md");
        let hits = search_notes(&conn, "全文检索", 5).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].snippet.contains("<b>全文检索</b>"));
        upsert(&conn, "欢迎.md", "# 欢迎\n\n只留下 [[项目/计划]]。\n", 2).unwrap();
        assert!(backlinks_for(&conn, "日常/周报.md").is_empty());
        rename_path(&conn, "项目/计划.md", "项目/路线.md");
        assert_eq!(backlinks_for(&conn, "项目/路线.md")[0].path, "欢迎.md");
        delete_path(&conn, "项目");
        assert_eq!(backlinks_for(&conn, "项目/路线.md")[0].path, "欢迎.md");
        delete_path(&conn, "欢迎.md");
        assert!(backlinks_for(&conn, "项目/路线.md").is_empty());
    }

    #[test]
    fn reindex_reads_markdown_files() {
        let root = std::env::temp_dir().join(format!("ainotes-index-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("日常")).unwrap();
        fs::write(root.join("欢迎.md"), "# 欢迎\n\n见 [[周报]]。\n").unwrap();
        fs::write(root.join("日常/周报.md"), "# 周报\n\n本地全文。\n").unwrap();
        let conn = memory();
        rebuild(&conn, &root).unwrap();
        assert_eq!(backlinks_for(&conn, "日常/周报.md")[0].path, "欢迎.md");
        assert_eq!(search_notes(&conn, "本地全文", 5).unwrap()[0].path, "日常/周报.md");
        let _ = fs::remove_dir_all(&root);
    }
}
