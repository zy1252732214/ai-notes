/** 笔记元数据。正文以磁盘上的 Markdown 为准，这里只是索引摘要。 */
export interface NoteMetadata {
  path: string;
  title: string;
  /** ISO-8601 UTC。 */
  createdAt: string;
  /** ISO-8601 UTC。 */
  updatedAt: string;
  /** 文件字节数。 */
  size: number;
  frontmatter: Readonly<Record<string, unknown>>;
  /** 不含前导 `#`。 */
  tags: readonly string[];
  /** 出链目标，按笔记里写下的路径原样返回。 */
  links: readonly string[];
}

export type VaultEntryKind = "note" | "folder" | "attachment";

export interface VaultEntry {
  path: string;
  name: string;
  kind: VaultEntryKind;
}

export interface VaultListOptions {
  /** 相对 Vault 根的文件夹。省略表示根目录。 */
  folder?: string;
  /** 默认 false，只列直接子项。 */
  recursive?: boolean;
}

export interface VaultWriteOptions {
  /** 为 true 时允许覆盖已有文件。默认 false，已存在则失败。 */
  overwrite?: boolean;
}

/**
 * 笔记读写。路径都是 Vault 相对路径，使用 `/`，不能以 `/` 开头，不能包含 `..`。
 * 读操作需要 `vault:read`（并受 folders 限制）；写操作需要 `vault:write`。
 */
export interface VaultApi {
  /** 读取笔记正文。 */
  read(path: string): Promise<string>;

  /** 列出笔记、文件夹和附件。 */
  list(options?: VaultListOptions): Promise<readonly VaultEntry[]>;

  /** 创建笔记。父文件夹不存在时由宿主创建。 */
  create(path: string, content: string, options?: VaultWriteOptions): Promise<NoteMetadata>;

  /** 整体替换已有笔记的正文。 */
  modify(path: string, content: string): Promise<NoteMetadata>;

  /** 删除笔记文件。 */
  delete(path: string): Promise<void>;

  /** 改名或移动。宿主负责更新双链。 */
  rename(from: string, to: string): Promise<void>;

  /** 读取索引里的元数据，不返回正文。 */
  getMetadata(path: string): Promise<NoteMetadata>;
}
