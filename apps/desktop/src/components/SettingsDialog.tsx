import { Button, Dialog, Input, Select, SettingsRow } from '@ai-notes/ui';
import { useEffect, useState } from 'react';
import {
  defaultAiSettings,
  loadAiSettings,
  normalizeAiSettings,
  saveAiSettings,
  type AiProviderId,
  type AiSettings,
  type ProviderSettings,
} from '../ai/settings';
import { useAppStore } from '../store';

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const [draft, setDraft] = useState<AiSettings>(defaultAiSettings);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(loadAiSettings());
    setError(null);
  }, [open]);

  const active = draft.provider === 'ollama' ? draft.ollama : draft.openai;

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
      onClose={() => setSettingsOpen(false)}
      title="模型设置"
      description="密钥只保存在这台设备的本地存储里，不会写进笔记库。"
      footer={
        <>
          <Button onClick={() => setSettingsOpen(false)}>取消</Button>
          <Button
            variant="primary"
            onClick={() => {
              try {
                saveAiSettings(normalizeAiSettings(draft));
                setSettingsOpen(false);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : '无法保存');
              }
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="ai-settings">
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
          label="API Key"
          htmlFor="ai-api-key"
          description={draft.provider === 'ollama' ? '本机 Ollama 通常不需要。' : '只存在本地。'}
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
        {error ? (
          <p className="ai-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
