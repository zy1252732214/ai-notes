export const previewSections = [
  { id: 'button', title: 'Button', summary: '主操作、次操作、幽灵按钮和危险操作。' },
  { id: 'icon-button', title: 'IconButton', summary: '只有图标时必须给读屏名称。' },
  { id: 'input', title: 'Input', summary: '带标签的单行输入，错误和禁用分开显示。' },
  { id: 'textarea', title: 'Textarea', summary: '多行输入，提示和错误都挂在描述上。' },
  { id: 'select', title: 'Select', summary: '键盘可打开的列表框，会跳过禁用项。' },
  { id: 'switch', title: 'Switch', summary: '开关。空格和点击都会切换。' },
  { id: 'tabs', title: 'Tabs', summary: '方向键移动，Home / End 跳到两端。' },
  { id: 'tooltip', title: 'Tooltip', summary: '悬停或聚焦出现，Esc 关闭。' },
  { id: 'dialog', title: 'Dialog', summary: '模态对话框，焦点在内部循环。' },
  { id: 'toast', title: 'Toast', summary: '短暂通知。错误用 alert，其余用 status。' },
  { id: 'command-palette', title: 'CommandPalette', summary: '搜索命令，上下选择，回车执行。' },
  {
    id: 'search-result',
    title: 'SearchResultItem',
    summary: '一条搜索结果，当前项带 aria-current。',
  },
  { id: 'panel', title: 'Panel', summary: '可收起的分区，按钮上有 aria-expanded。' },
  { id: 'chat-message', title: 'ChatMessage', summary: '用户、AI，以及带来源的引用卡片。' },
  { id: 'settings-row', title: 'SettingsRow', summary: '设置表单的一行：标签、说明、控件。' },
] as const;

export type PreviewSectionId = (typeof previewSections)[number]['id'];
