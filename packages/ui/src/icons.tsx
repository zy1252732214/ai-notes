type IconName = 'close' | 'chevron-right' | 'check';

const paths: Record<IconName, string> = {
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-right': 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.2 4.2L19 7.5',
};

/** 组件内部用的小图标。线宽 1.5，尺寸只有 16 和 20。颜色跟随 `currentColor`。 */
export function UiIcon({ name, size = 16 }: { name: IconName; size?: 16 | 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
