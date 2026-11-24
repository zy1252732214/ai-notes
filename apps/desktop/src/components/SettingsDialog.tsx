import { Button, Dialog, Input, Select, SettingsRow } from '@ai-notes/ui';
import { useEffect, useRef, useState } from 'react';
import {
  defaultAiSettings,
  loadAiSettings,
  normalizeAiSettings,
  saveAiSettings,
  secretsInKeychain,
  type AiProviderId,
  type AiSettings,
  type ProviderSettings,
} from '../ai/settings';
import { getNoteIndex } from '../search/client';
import { useAppStore, type ThemeMode } from '../store';
import { applyTheme } from '../theme';
import { commitDialogSave } from './settingsSave';

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const [draft, setDraft] = useState<AiSettings>(defaultAiSettings);
  const [themeDraft, setThemeDraft] = useState<ThemeMode>(themeMode);
  const [error, setError] = useState<string | null>(null);
  const themeWhenOpened = useRef<ThemeMode>(themeMode);

  useEffect(() => {
    if (!open) return;
    const current = useAppStore.getState().themeMode;
    themeWhenOpened.current = current;
    setThemeDraft(current);
    setDraft(loadAiSettings());
    setError(null);
  }, [open]);

  const dismiss = () => {
    applyTheme(themeWhenOpened.current);
    setThemeDraft(themeWhenOpened.current);
    setSettingsOpen(false);
  };

  const active = draft.provider === 'ollama' ? draft.ollama : draft.openai;
  const secure = secretsInKeychain();

  const updateActive = (patch: Partial<ProviderSettings>) => {
    setDraft((current) => {
      const key = current.provider;
      return { ...current, [key]: { ...current[key], ...patch } };
    });
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title="设置"
      description={
        secure
          ? 'API Key 存在系统钥匙串里。其余设置只在这台设备上，不会写进笔记库。'
          : '密钥和其余设置只在这台设备上，不会写进笔记库。'
      }
      footer={
        <div className="settings-footer">
          {error ? (
            <p className="ai-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="settings-footer-actions">
            <Button onClick={dismiss}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  const result = await commitDialogSave({
                    draft,
                    theme: themeDraft,
                    rememberTheme: (theme) => {
                      themeWhenOpened.current = theme;
                      setThemeMode(theme);
                    },
                    saveAi: (next) => saveAiSettings(normalizeAiSettings(next)),
                  });
                  if (result.error) setError(result.error);
                  if (!result.closed) return;
                  void getNoteIndex()?.syncEmbeddings();
                  setSettingsOpen(false);
                })();
              }}
            >
              保存
            </Button>
          </div>
        </div>
      }
    >
      <div className="ai-settings">
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h3 id="settings-appearance">外观</h3>
          <SettingsRow
            label="主题"
            htmlFor="theme-mode"
            description="跟随系统，或固定为浅色、深色。"
          >
            <Select
              id="theme-mode"
              label="主题"
              labelHidden
              value={themeDraft}
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]}
              onChange={(value) => {
                const next = value as ThemeMode;
                setThemeDraft(next);
                applyTheme(next);
              }}
            />
          </SettingsRow>
        </section>
        <section className="settings-section" aria-labelledby="settings-model">
          <h3 id="settings-model">模型</h3>
          <p className="settings-section-note">对话和嵌入用的接口。密钥不写入笔记。</p>
          <SettingsRow
            label="提供方"
            htmlFor="ai-provider"
            description="OpenAI 兼容接口，或本机 Ollama。"
          >
            <Select
              id="ai-provider"
              label="提供方"
              labelHidden
              value={draft.provider}
              options={[
                { value: 'openai', label: 'OpenAI 兼容' },
                { value: 'ollama', label: 'Ollama' },
              ]}
              onChange={(value) => {
                setDraft((current) => ({ ...current, provider: value as AiProviderId }));
                setError(null);
              }}
            />
          </SettingsRow>
          <SettingsRow label="接口地址" htmlFor="ai-base-url">
            <Input
              id="ai-base-url"
              label="接口地址"
              labelHidden
              value={active.baseUrl}
              spellCheck={false}
              onChange={(event) => updateActive({ baseUrl: event.target.value })}
            />
          </SettingsRow>
          <SettingsRow label="模型" htmlFor="ai-model">
            <Input
              id="ai-model"
              label="模型"
              labelHidden
              value={active.model}
              spellCheck={false}
              onChange={(event) => updateActive({ model: event.target.value })}
            />
          </SettingsRow>
          <SettingsRow
            label="嵌入模型"
            htmlFor="ai-embed-model"
            description="留空则只用全文检索，不会请求嵌入接口。DeepSeek 这类只提供对话的服务保持留空。"
          >
            <Input
              id="ai-embed-model"
              label="嵌入模型"
              labelHidden
              value={draft.embedModel}
              spellCheck={false}
              placeholder={draft.provider === 'ollama' ? 'nomic-embed-text' : '留空，只用全文'}
              onChange={(event) => {
                setDraft((current) => ({ ...current, embedModel: event.target.value }));
                setError(null);
              }}
            />
          </SettingsRow>
          <SettingsRow
            label="API Key"
            htmlFor="ai-api-key"
            description={
              draft.provider === 'ollama'
                ? '本机 Ollama 通常不需要。'
                : secure
                  ? '存在系统钥匙串里。'
                  : '只存在本地。'
            }
          >
            <Input
              id="ai-api-key"
              label="API Key"
              labelHidden
              type="password"
              autoComplete="off"
              value={active.apiKey}
              onChange={(event) => updateActive({ apiKey: event.target.value })}
            />
          </SettingsRow>
        </section>
      </div>
    </Dialog>
  );
}
