import {
  Button,
  ChatMessage,
  CommandPalette,
  Dialog,
  IconButton,
  Input,
  Panel,
  SearchResultItem,
  Select,
  SettingsRow,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from '@ai-notes/ui';
import { Moon, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type PreviewSectionId } from './catalog';

export function PreviewSection({ id }: { id: PreviewSectionId }) {
  switch (id) {
    case 'button':
      return <ButtonSection />;
    case 'icon-button':
      return <IconButtonSection />;
    case 'input':
      return <InputSection />;
    case 'textarea':
      return <TextareaSection />;
    case 'select':
      return <SelectSection />;
    case 'switch':
      return <SwitchSection />;
    case 'tabs':
      return <TabsSection />;
    case 'tooltip':
      return <TooltipSection />;
    case 'dialog':
      return <DialogSection />;
    case 'toast':
      return <ToastSection />;
    case 'command-palette':
      return <CommandPaletteSection />;
    case 'search-result':
      return <SearchResultSection />;
    case 'panel':
      return <PanelSection />;
    case 'chat-message':
      return <ChatSection />;
    case 'settings-row':
      return <SettingsSection />;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function ButtonSection() {
  return (
    <div className="preview-row">
      <Button variant="primary">保存</Button>
      <Button variant="secondary">取消</Button>
      <Button variant="ghost">稍后</Button>
      <Button variant="danger">删除</Button>
      <Button variant="primary" size="sm">
        小按钮
      </Button>
      <Button variant="primary" disabled>
        保存中
      </Button>
    </div>
  );
}

function IconButtonSection() {
  return (
    <div className="preview-row">
      <IconButton label="新建笔记">
        <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      <IconButton label="搜索">
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      <IconButton label="删除笔记" variant="danger">
        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      <IconButton label="更多操作" disabled>
        <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      <IconButton label="深色模式" pressed>
        <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function InputSection() {
  return (
    <div className="preview-stack">
      <Input label="笔记标题" placeholder="无标题" />
      <Input label="已填写" defaultValue="周记" hint="显示在侧栏里" />
      <Input label="路径" defaultValue="" error="不能为空" />
      <Input label="只读标题" defaultValue="已归档" disabled />
    </div>
  );
}

function TextareaSection() {
  return (
    <div className="preview-stack">
      <Textarea label="正文" placeholder="写点什么" hint="支持 Markdown" />
      <Textarea label="摘录" defaultValue="" error="摘录太短" />
      <Textarea label="已锁定" defaultValue="这段不能改。" disabled />
    </div>
  );
}

function SelectSection() {
  const [theme, setTheme] = useState('light');
  return (
    <div className="preview-stack">
      <Select
        label="主题"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
          { value: 'system', label: '跟随系统', disabled: true },
        ]}
      />
      <Select
        label="模型"
        value=""
        onChange={() => {}}
        placeholder="尚未配置"
        options={[]}
        disabled
      />
    </div>
  );
}

function SwitchSection() {
  const [saved, setSaved] = useState(true);
  return (
    <div className="preview-stack">
      <Switch
        label="自动保存"
        description="停下输入后写入磁盘"
        checked={saved}
        onChange={setSaved}
      />
      <Switch label="已关闭" checked={false} onChange={() => {}} />
      <Switch label="不可用" checked={false} disabled onChange={() => {}} />
    </div>
  );
}

function TabsSection() {
  return (
    <Tabs
      label="笔记设置"
      tabs={[
        { id: 'look', label: '外观', content: '编辑区最大宽度沿用 --an-editor-max-width。' },
        { id: 'edit', label: '编辑', content: '保存快捷键是 Ctrl 或 Cmd + S。' },
        { id: 'sync', label: '同步', content: '同步还没接上。', disabled: true },
      ]}
    />
  );
}

function TooltipSection() {
  return (
    <div className="preview-row">
      <Tooltip content="把当前笔记写入磁盘">
        <Button variant="primary">保存</Button>
      </Tooltip>
      <Tooltip content="在下方显示" side="bottom">
        <Button variant="secondary">下方提示</Button>
      </Tooltip>
    </div>
  );
}

function DialogSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="preview-row">
      <Button variant="danger" onClick={() => setOpen(true)}>
        删除笔记
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="删除笔记"
        description="文件会从库里移除。这个操作可以在系统回收站里找回来。"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              删除
            </Button>
          </>
        }
      >
        <p>确认删除「周记」？</p>
      </Dialog>
    </div>
  );
}

function ToastSection() {
  const toast = useToast();
  return (
    <div className="preview-row">
      <Button
        variant="secondary"
        onClick={() => toast.push({ title: '已复制链接', tone: 'info', duration: 0 })}
      >
        提示
      </Button>
      <Button
        variant="primary"
        onClick={() =>
          toast.push({ title: '已保存', description: '周记.md', tone: 'success', duration: 0 })
        }
      >
        成功
      </Button>
      <Button
        onClick={() =>
          toast.push({
            title: '索引稍旧',
            description: '正在重新分块',
            tone: 'warning',
            duration: 0,
          })
        }
      >
        注意
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          toast.push({ title: '无法保存', description: '磁盘只读', tone: 'danger', duration: 0 })
        }
      >
        错误
      </Button>
    </div>
  );
}

function CommandPaletteSection() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('还没有选择');
  return (
    <div className="preview-stack">
      <div className="preview-row">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          打开命令面板
        </Button>
        <span className="preview-note">当前：{picked}</span>
      </div>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => setPicked(item.title)}
        items={[
          { id: 'open', title: '打开文件夹', hint: '文件' },
          { id: 'sample', title: '打开示例库', hint: '内存', keywords: 'sample' },
          { id: 'new', title: '新建笔记', hint: '笔记' },
          { id: 'theme', title: '切换深色模式', hint: '外观', keywords: 'dark theme' },
          { id: 'soon', title: '同步到云端', hint: '尚未开放', disabled: true },
        ]}
      />
    </div>
  );
}

function SearchResultSection() {
  const [active, setActive] = useState('week');
  const results = [
    { id: 'week', title: '周记', path: 'notes/week.md', snippet: '今天把按钮和对话框补上了。' },
    {
      id: 'index',
      title: '索引设计',
      path: 'docs/index.md',
      snippet: 'FTS5 负责全文，sqlite-vec 负责向量。',
    },
  ];
  return (
    <div className="preview-list">
      {results.map((result) => (
        <SearchResultItem
          key={result.id}
          title={result.title}
          path={result.path}
          snippet={result.snippet}
          active={active === result.id}
          onSelect={() => setActive(result.id)}
        />
      ))}
    </div>
  );
}

function PanelSection() {
  return (
    <div className="preview-stack preview-panels">
      <Panel title="文件">
        <p>日常 / 周记.md</p>
      </Panel>
      <Panel title="大纲" defaultOpen={false}>
        <p>这里收起时不会读出内容。</p>
      </Panel>
    </div>
  );
}

function ChatSection() {
  return (
    <div className="preview-stack">
      <ChatMessage role="user" content="帮我把昨天的会议收成三条。" />
      <ChatMessage
        role="assistant"
        content="1. 组件只使用现有令牌。2. 预览页要能切换主题。3. 对话框需要焦点循环。"
      />
      <ChatMessage
        role="citation"
        citation={{
          title: '设计令牌',
          source: 'packages/ui/tokens.css',
          excerpt: '插件样式必须使用这些 --an-* 变量，禁止写死颜色。',
        }}
      />
    </div>
  );
}

function SettingsSection() {
  const [autosave, setAutosave] = useState(true);
  const [font, setFont] = useState('ui');
  return (
    <div className="preview-settings">
      <SettingsRow label="自动保存" description="停下输入后写入磁盘" htmlFor="preview-autosave">
        <Switch
          id="preview-autosave"
          label="自动保存"
          labelHidden
          checked={autosave}
          onChange={setAutosave}
        />
      </SettingsRow>
      <SettingsRow label="界面字号" description="只影响侧栏和菜单" htmlFor="preview-font">
        <Select
          id="preview-font"
          label="界面字号"
          labelHidden
          className="preview-settings-select"
          value={font}
          onChange={setFont}
          options={[
            { value: 'ui', label: '标准' },
            { value: 'large', label: '较大' },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="库路径" description="当前打开的文件夹">
        <span className="preview-note">~/Notes</span>
      </SettingsRow>
    </div>
  );
}
