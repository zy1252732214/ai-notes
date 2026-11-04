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
