import { MarkdownEditor } from '@ai-notes/editor';
import { VaultError } from '@ai-notes/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { openFolderVault } from '../fs/openVault';
import {
  beginOllamaOnboarding,
  getOnboardingProbe,
  ollamaHint,
  subscribeOnboardingProbe,
  welcomeMode,
  type WelcomeMode,
} from '../onboarding/guide';
import { useAppStore } from '../store';
import { ReviewView } from './ReviewView';
import { WelcomeScreen } from './WelcomeScreen';

export function EditorPane() {
  const vault = useAppStore((state) => state.vault);
  const tabs = useAppStore((state) => state.tabs);
  const activePath = useAppStore((state) => state.activePath);
  const banner = useAppStore((state) => state.banner);
  const bannerTone = useAppStore((state) => state.bannerTone);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const updateContent = useAppStore((state) => state.updateContent);
  const saveActive = useAppStore((state) => state.saveActive);
  const setCursor = useAppStore((state) => state.setCursor);
  const openDialog = useAppStore((state) => state.openDialog);
  const openVault = useAppStore((state) => state.openVault);
  const setBanner = useAppStore((state) => state.setBanner);
  const reveal = useAppStore((state) => state.reveal);
  const openLink = useAppStore((state) => state.openLink);
  const reviewOpen = useAppStore((state) => state.reviewOpen);
  const vaultEpoch = useAppStore((state) => state.vaultEpoch);
  const setEditorSelection = useAppStore((state) => state.setEditorSelection);
  const jump = reveal && active && reveal.path === active.path ? reveal : null;

  const openFolder = async () => {
    try {
      const next = await openFolderVault();
      if (next) await openVault(next.vault, next.plugins);
    } catch (error) {
      const message =
        error instanceof VaultError || error instanceof Error ? error.message : '无法打开文件夹';
      setBanner(message);
    }
  };

  return (
    <main className="editor-pane">
      {banner ? (
        <div className={bannerTone === 'info' ? 'banner info' : 'banner'} role="status">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)}>关闭</button>
        </div>
      ) : null}
      {vault ? <ReviewView key={vaultEpoch} /> : null}
      {reviewOpen ? null : active ? (
        <MarkdownEditor
          path={active.path}
          value={active.content}
          onChange={(content) => updateContent(active.path, content)}
          onSave={() => void saveActive()}
          onCursorChange={setCursor}
          onSelectionChange={setEditorSelection}
          reveal={jump}
          onOpenLink={(target) => void openLink(target)}
        />
      ) : reviewOpen ? null : vault ? (
        <div className="empty-state">
          <h1>{vault.name}</h1>
          <p>从左侧选择一篇笔记，或新建一篇。正文会按 Markdown 原文保存。</p>
          <button className="button primary" onClick={() => openDialog({ kind: 'create-note' })}>
            新建笔记
          </button>
        </div>
      ) : (
        <LibraryWelcome onOpenFolder={() => void openFolder()} />
      )}
    </main>
  );
}

function LibraryWelcome({ onOpenFolder }: { onOpenFolder: () => void }) {
  const openSampleVault = useAppStore((state) => state.openSampleVault);
  const [mode] = useState<WelcomeMode>(() =>
    typeof localStorage === 'undefined' ? 'first-run' : welcomeMode(localStorage),
  );
  const probe = useSyncExternalStore(
    subscribeOnboardingProbe,
    getOnboardingProbe,
    getOnboardingProbe,
  );
  useEffect(() => {
    void beginOllamaOnboarding(typeof localStorage === 'undefined' ? undefined : localStorage);
  }, []);
  return (
    <WelcomeScreen
      mode={mode}
      hint={ollamaHint(probe)}
      onOpenSample={() => {
        void openSampleVault();
      }}
      onOpenFolder={onOpenFolder}
    />
  );
}
