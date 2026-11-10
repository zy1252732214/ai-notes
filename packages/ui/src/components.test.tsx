// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  ToastProvider,
  Tooltip,
  useToast,
} from './index.js';
import { nextTabId } from './components/tabs.js';

afterEach(() => {
  cleanup();
});

describe('Button and IconButton', () => {
  it('renders variants and keeps disabled buttons out of the way', () => {
    render(
      <>
        <Button variant="primary">保存</Button>
        <Button variant="danger" disabled>
          删除
        </Button>
        <IconButton label="更多" pressed={false} />
      </>,
    );

    expect(screen.getByRole('button', { name: '保存' }).className).toContain('an-button--primary');
    const danger = screen.getByRole('button', { name: '删除' });
    expect(danger.className).toContain('an-button--danger');
    expect(danger.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '更多' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Input and Textarea', () => {
  it('connects the label, hint, and error', () => {
    render(
      <>
        <Input label="标题" error="不能为空" />
        <Textarea label="正文" hint="支持 Markdown" />
      </>,
    );

    const title = screen.getByLabelText('标题');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    const errorId = title.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId ?? '')?.textContent).toBe('不能为空');

    const body = screen.getByLabelText('正文');
    const hintId = body.getAttribute('aria-describedby');
    expect(document.getElementById(hintId ?? '')?.textContent).toBe('支持 Markdown');
    expect(body.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('Select', () => {
  it('opens from the keyboard and skips disabled options', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="主题"
        value="light"
        onChange={onChange}
        options={[
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
          { value: 'system', label: '跟随系统', disabled: true },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: '主题 浅色' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Switch', () => {
  it('exposes a switch and toggles from the label text', () => {
    const onChange = vi.fn();
    render(<Switch label="深色模式" description="立即切换" checked={false} onChange={onChange} />);

    const control = screen.getByRole('switch', { name: '深色模式' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(screen.getByText('深色模式'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Tabs', () => {
  it('moves with the arrow keys and skips disabled tabs', () => {
    expect(
      nextTabId(
        [{ id: 'one' }, { id: 'two' }, { id: 'three', disabled: true }],
        'two',
        'ArrowRight',
      ),
    ).toBe('one');

    render(
      <Tabs
        label="预览"
        tabs={[
          { id: 'one', label: '外观', content: '外观面板' },
          { id: 'two', label: '编辑', content: '编辑面板' },
          { id: 'three', label: '禁用', content: '不会出现', disabled: true },
        ]}
      />,
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: '外观' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '编辑' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('编辑面板');
    fireEvent.keyDown(screen.getByRole('tab', { name: '编辑' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '外观' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Tooltip', () => {
  it('shows on focus and closes with Escape', () => {
    render(
      <Tooltip content="保存当前笔记">
        <Button>保存</Button>
      </Tooltip>,
    );

    const button = screen.getByRole('button', { name: '保存' });
    fireEvent.focus(button);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('保存当前笔记');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Dialog', () => {
  it('traps focus and closes from Escape or the backdrop', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>打开对话框</Button>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="删除笔记"
            description="删除后无法恢复。"
            footer={<Button onClick={() => setOpen(false)}>确定</Button>}
          >
            <p>确认删除这篇笔记？</p>
          </Dialog>
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开对话框' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: '删除笔记' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);

    const close = screen.getByRole('button', { name: '关闭' });
    const confirm = screen.getByRole('button', { name: '确定' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    const backdrop = document.querySelector('.an-overlay');
    expect(backdrop).toBeTruthy();
    if (!backdrop) return;
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Toast', () => {
  it('announces a status and lets the reader dismiss it', () => {
    function Harness() {
      const toast = useToast();
      return (
        <Button onClick={() => toast.push({ title: '已保存', tone: 'success', duration: 0 })}>
          保存
        </Button>
      );
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('status').textContent).toContain('已保存');
    fireEvent.click(screen.getByRole('button', { name: '关闭通知' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses an alert for danger and dismisses itself', async () => {
    function Harness() {
      const toast = useToast();
      return (
        <Button onClick={() => toast.push({ title: '保存失败', tone: 'danger', duration: 30 })}>
          出错
        </Button>
      );
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出错' }));
    expect(screen.getByRole('alert').textContent).toContain('保存失败');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('refuses to run outside the provider', () => {
    function Harness() {
      useToast();
      return null;
    }
    expect(() => render(<Harness />)).toThrow(/ToastProvider/);
  });
});

describe('CommandPalette', () => {
  it('filters commands and selects the active row', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        onSelect={onSelect}
        items={[
          { id: 'open', title: '打开文件夹' },
          { id: 'new', title: '新建笔记', hint: '笔记', keywords: 'note' },
          { id: 'disabled', title: '不可用', disabled: true },
        ]}
      />,
    );

    const input = screen.getByRole('combobox', { name: '搜索笔记或命令' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'note' } });
    expect(screen.getByRole('option', { name: /新建笔记/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '打开文件夹' })).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SearchResultItem', () => {
  it('marks the active result', () => {
    const onSelect = vi.fn();
    render(
      <SearchResultItem
        title="周记"
        path="notes/week.md"
        snippet="今天"
        active
        onSelect={onSelect}
      />,
    );
    const result = screen.getByRole('button', { name: /周记/ });
    expect(result.getAttribute('aria-current')).toBe('true');
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('Panel', () => {
  it('collapses and hides the body', () => {
    render(
      <Panel title="文件">
        <p>笔记列表</p>
      </Panel>,
    );
    const header = screen.getByRole('button', { name: '文件' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('笔记列表')).toBeTruthy();
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    const body = document.getElementById(header.getAttribute('aria-controls') ?? '');
    expect(body?.hasAttribute('hidden')).toBe(true);
  });
});

describe('ChatMessage', () => {
  it('labels user, assistant, and citation messages', () => {
    render(
      <>
        <ChatMessage role="user" content="你好" />
        <ChatMessage role="assistant" content="我在" />
        <ChatMessage
          role="citation"
          citation={{ title: '周记', source: 'notes/week.md', excerpt: '今天写了组件。' }}
        />
      </>,
    );

    expect(screen.getByRole('article', { name: '你的消息' }).textContent).toContain('你好');
    expect(screen.getByRole('article', { name: 'AI 回复' }).textContent).toContain('我在');
    const citation = screen.getByRole('article', { name: '引用 周记' });
    expect(citation.textContent).toContain('今天写了组件。');
    expect(citation.textContent).toContain('notes/week.md');
  });
});

describe('SettingsRow', () => {
  it('associates the row label with the control', () => {
    render(
      <SettingsRow label="自动保存" description="编辑后写入磁盘" htmlFor="auto-save">
        <Switch id="auto-save" label="自动保存" labelHidden checked onChange={() => {}} />
      </SettingsRow>,
    );

    const label = document.querySelector('label[for="auto-save"]');
    expect(label?.textContent).toBe('自动保存');
    expect(screen.getByText('编辑后写入磁盘')).toBeTruthy();
    expect(screen.getByRole('switch', { name: '自动保存' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});
