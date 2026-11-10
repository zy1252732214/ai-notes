import type {
  ChatRequest,
  ChatResult,
  CompleteRequest,
  CompleteResult,
  NetworkRequest,
  NetworkResponse,
  NoteMetadata,
  VaultEntry,
} from '@ai-notes/plugin-sdk';

export interface ActiveNote {
  path: string;
  content: string;
  selection: string;
}

/** 宿主提供给已获授权调用的能力。权限拒绝发生在调用这些方法之前。 */
export interface PluginServices {
  listNotes(folder?: string, recursive?: boolean): Promise<readonly VaultEntry[]>;
  readNote(path: string): Promise<string>;
  createNote(path: string, content: string, overwrite?: boolean): Promise<NoteMetadata>;
  modifyNote(path: string, content: string): Promise<NoteMetadata>;
  deleteNote(path: string): Promise<void>;
  renameNote(from: string, to: string): Promise<void>;
  metadata(path: string): Promise<NoteMetadata>;
  activeNote(): ActiveNote | null;
  replaceSelection(text: string): Promise<void>;
  insertAtCursor(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  fetch(request: NetworkRequest): Promise<NetworkResponse>;
  chat(request: ChatRequest): Promise<ChatResult>;
  complete(request: CompleteRequest): Promise<CompleteResult>;
}

export function unavailable(feature: string): never {
  throw new Error(`${feature} 还没有接入`);
}
