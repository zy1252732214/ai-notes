import { basename, type VaultError } from '@ai-notes/core';
import { useEffect, useId, useState } from 'react';
import { noteTitle, useAppStore } from '../store';

export function NameDialog() {
  const dialog = useAppStore((state) => state.dialog);
  const closeDialog = useAppStore((state) => state.closeDialog);
  const createNote = useAppStore((state) => state.createNote);
  const createFolder = useAppStore((state) => state.createFolder);
  const renameEntry = useAppStore((state) => state.renameEntry);
  const deleteEntry = useAppStore((state) => state.deleteEntry);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!dialog) return;
    if (dialog.kind === 'rename' && dialog.path) {
      setValue(dialog.entryKind === 'file' ? noteTitle(dialog.path) : basename(dialog.path));
    } else {
      setValue('');
    }
    setError(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);

  if (!dialog) return null;

  const title =
    dialog.kind === 'create-note'
      ? '新建笔记'
      : dialog.kind === 'create-folder'
        ? '新建文件夹'
        : dialog.kind === 'rename'
          ? '重命名'
          : dialog.entryKind === 'directory'
            ? '删除文件夹'
            : '删除笔记';

  const submit = async () => {
    try {
      if (dialog.kind === 'create-note') await createNote(value);
      else if (dialog.kind === 'create-folder') await createFolder(value);
      else if (dialog.kind === 'rename' && dialog.path) await renameEntry(dialog.path, value);
      else if (dialog.kind === 'delete' && dialog.path) await deleteEntry(dialog.path);
      closeDialog();
    } catch (caught) {
      const failure = caught as VaultError;
      setError(failure.message || '操作没有完成');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={closeDialog}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {dialog.kind === 'delete' ? (
          <p>
            {dialog.entryKind === 'directory'
              ? `删除文件夹「${basename(dialog.path ?? '')}」以及里面的笔记？此操作不可撤销。`
              : `删除「${basename(dialog.path ?? '')}」？此操作不可撤销。`}
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              名称
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={dialog.kind === 'create-folder' ? '例如：项目' : '例如：周报'}
              />
            </label>
          </form>
        )}
        {error ? <p className="danger">{error}</p> : null}
        <div className="modal-actions">
          <button className="button" onClick={closeDialog}>
            取消
          </button>
          <button
            className={dialog.kind === 'delete' ? 'button danger' : 'button primary'}
            onClick={() => void submit()}
          >
            {dialog.kind === 'delete' ? '删除' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
}
