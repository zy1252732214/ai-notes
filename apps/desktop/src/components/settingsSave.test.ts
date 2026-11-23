import { describe, expect, it, vi } from 'vitest';
import { defaultAiSettings } from '../ai/settings';
import { commitDialogSave } from './settingsSave';

describe('commitDialogSave', () => {
  it('remembers the theme even when the model settings are rejected', async () => {
    const rememberTheme = vi.fn();
    const saveAi = vi.fn(async () => {
      throw new Error('请填写 API Key');
    });

    const result = await commitDialogSave({
      draft: defaultAiSettings,
      theme: 'dark',
      rememberTheme,
      saveAi,
    });

    expect(rememberTheme).toHaveBeenCalledWith('dark');
    expect(result).toEqual({ closed: false, error: '请填写 API Key' });
  });

  it('closes after both the theme and the model settings are stored', async () => {
    const rememberTheme = vi.fn();
    const saveAi = vi.fn(async () => undefined);

    const result = await commitDialogSave({
      draft: defaultAiSettings,
      theme: 'light',
      rememberTheme,
      saveAi,
    });

    expect(rememberTheme).toHaveBeenCalledWith('light');
    expect(saveAi).toHaveBeenCalledWith(defaultAiSettings);
    expect(result.closed).toBe(true);
  });
});
