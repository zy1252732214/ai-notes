import { useId } from 'react';

/** 拼接 class，忽略空值。 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

/** `useId` 里的冒号不能直接当 CSS 选择器，这里换成稳定的 DOM id。 */
export function useDomId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}
