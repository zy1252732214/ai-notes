/** 插件日志和界面提示。info 会自动收起，danger 一直留到用户关闭或这次错误被修好。 */

export type NoticeTone = 'danger' | 'info';

export interface NoticeState {
  banner: string | null;
  bannerTone: NoticeTone;
}

export const INFO_NOTICE_MS = 4500;

export function toneForPluginLog(level: string | undefined): NoticeTone {
  return level === 'error' ? 'danger' : 'info';
}

/**
 * 普通提示不能盖住还没关闭的错误。
 * 关掉提示时把语气收回 danger，下一次缺省仍是错误横幅。
 */
export function nextNotice(
  state: NoticeState,
  message: string | null,
  tone: NoticeTone = 'danger',
): NoticeState {
  if (message && tone !== 'danger' && state.banner && state.bannerTone === 'danger') {
    return state;
  }
  if (!message) return { banner: null, bannerTone: 'danger' };
  return { banner: message, bannerTone: tone };
}

export function saveStatusLabel(input: {
  hasNote: boolean;
  dirty: boolean;
  saveError: string | null;
}): string {
  if (!input.hasNote) return '未打开笔记';
  if (input.saveError) return '保存失败';
  if (input.dirty) return '未保存';
  return '已保存';
}
