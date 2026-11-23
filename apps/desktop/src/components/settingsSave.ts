import type { AiSettings } from '../ai/settings';
import type { ThemeMode } from '../store';

export interface DialogSaveResult {
  closed: boolean;
  error: string | null;
}

/**
 * 外观先记住。模型校验失败时对话框留着并显示错误，不再把已经选中的主题退回去。
 */
export async function commitDialogSave(options: {
  draft: AiSettings;
  theme: ThemeMode;
  rememberTheme: (theme: ThemeMode) => void;
  saveAi: (draft: AiSettings) => Promise<void>;
}): Promise<DialogSaveResult> {
  options.rememberTheme(options.theme);
  try {
    await options.saveAi(options.draft);
    return { closed: true, error: null };
  } catch (error) {
    return {
      closed: false,
      error: error instanceof Error ? error.message : '无法保存',
    };
  }
}
