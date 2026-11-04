import { MarkdownEditor } from '@ai-notes/editor';
import { VaultError } from '@ai-notes/core';
import { useAppStore } from '../store';
import { openFolderVault } from '../fs/openVault';

export function EditorPane() {
  const vault = useAppStore((state) => state.vault);
  const tabs = useAppStore((state) => state.tabs);
  const activePath = useAppStore((state) => state.activePath);
  const banner = useAppStore((state) => state.banner);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const updateContent = useAppStore((state) => state.updateContent);
  const saveActive = useAppStore((state) => state.saveActive);
  const setCursor = useAppStore((state) => state.setCursor);
  const openDialog = useAppStore((state) => state.openDialog);
  const openVault = useAppStore((state) => state.openVault);
  const openSampleVault = useAppStore((state) => state.openSampleVault);
  const setBanner = useAppStore((state) => state.setBanner);

  const openFolder = async () => {
    try {
      const next = await openFolderVault();
      if (next) await openVault(next);
    } catch (error) {
      const message =
        error instanceof VaultError || error instanceof Error ? error.message : '无法打开文件夹';
      setBanner(message);
    }
  };

  return (
    <main className="editor-pane">
      {banner ? (
        <div className="banner" role="status">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)}>关闭</button>
        </div>
      ) : null}
      {active ? (
        <MarkdownEditor
          path={active.path}
          value={active.content}
          onChange={(content) => updateContent(active.path, content)}
          onSave={() => void saveActive()}
          onCursorChange={setCursor}
        />
      ) : (
        <div className="empty-state">
          <h1>{vault ? vault.name : '打开一个笔记库'}</h1>
          {vault ? (
            <>
              <p>从左侧选择一篇笔记，或新建一篇。正文会按 Markdown 原文保存。</p>
              <button
                className="button primary"
                onClick={() => openDialog({ kind: 'create-note' })}
              >
                新建笔记
              </button>
            </>
          ) : (
            <>
              <p>选择一个文件夹作为 Vault。里面的 Markdown 文件会显示在左侧，编辑后写回磁盘。</p>
              <div className="empty-actions">
                <button className="button primary" onClick={() => void openFolder()}>
                  打开文件夹
                </button>
                <button className="button" onClick={() => void openSampleVault()}>
                  打开示例库
                </button>
              </div>
              <p className="hint">示例库只在内存里，用来熟悉界面，不会写入磁盘。</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
