import { MemoryFileSystem } from './memoryFs.js';
import { Vault } from './vault.js';

const welcome = `---
tags: [欢迎]
---

# 欢迎使用 ai-notes

这是一个本地优先的 Markdown 笔记库。每一篇笔记都是普通的 \`.md\` 文件，放在你自己选择的文件夹里。

## 现在可以做的事

- 在左侧浏览文件夹和笔记
- 在中间直接编辑 Markdown 原文
- 用 \`Ctrl/Cmd + S\` 保存，停笔后也会自动保存
- 新建、重命名和删除笔记

相关笔记：[[周报]]、[[计划]]

记忆卡片是普通 Markdown，放在「记忆」文件夹里。周报末尾有手写例子。命令面板可以「从当前笔记生成卡片」，也可以「开始复习」。

\`\`\`ts
const note = await vault.readNote("欢迎.md");
\`\`\`
`;

const weekly = `# 周报

## 这周

- 搭好三栏布局
- 打开本地文件夹作为 Vault
- 编辑器改的是 Markdown 原文

## 下周

- 双链和反向链接
- 全文检索

## 手写记忆卡片

下面三种写法会在打开库或保存笔记时收进「记忆」文件夹。显式 \`id\` 改字之后仍保留复习进度。

间隔重复算法::SM-2。第一次记住隔 1 天，第二次隔 6 天。

本地索引可以随时{{重建}}。

\`\`\`card
id: weekly-layout
Q: 这周完成了哪三件事？
A: 搭好三栏、把本地文件夹当作 Vault，编辑器改的是 Markdown 原文。
\`\`\`
`;

const plan = `# 计划

把笔记库当成长期记忆。本地文件是唯一事实来源，索引以后可以随时重建。

右侧面板留给以后的 AI：提问时带上当前笔记，回答需要附上可以点开的引用。
`;

export function createSampleVault(): Vault {
  return new Vault(
    '示例库',
    new MemoryFileSystem({
      '欢迎.md': welcome,
      '日常/周报.md': weekly,
      '项目/计划.md': plan,
    }),
  );
}
