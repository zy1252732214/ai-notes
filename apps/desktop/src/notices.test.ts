import { MemoryFileSystem, Vault, type VaultPath } from '@ai-notes/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INFO_NOTICE_MS, nextNotice, saveStatusLabel, toneForPluginLog } from './notices';
import { publishNotice, useAppStore } from './store';

class FailOnDemand extends MemoryFileSystem {
  fail = false;

  override async writeText(path: VaultPath, contents: string): Promise<void> {
    if (this.fail) throw new Error('磁盘已满');
    await super.writeText(path, contents);
  }
}

describe('提示和保存状态', () => {
  afterEach(() => {
    vi.useRealTimers();
    useAppStore.getState().setBanner(null);
    useAppStore.setState({ saveError: null });
  });

  it('新建成功时，插件的「新笔记」日志不是常驻错误', async () => {
    vi.useFakeTimers();
    const fs = new FailOnDemand();
    await useAppStore.getState().openVault(new Vault('验收', fs));
    await useAppStore.getState().createNote('验收来源');
    const state = useAppStore.getState();
    expect(state.activePath).toBe('验收来源.md');
    expect(state.saveError).toBeNull();
    expect(state.banner).toBeNull();
    expect(
      saveStatusLabel({
        hasNote: true,
        dirty: false,
        saveError: null,
      }),
    ).toBe('已保存');

    publishNotice('新笔记：验收来源.md', toneForPluginLog('info'));
    expect(useAppStore.getState().banner).toBe('新笔记：验收来源.md');
    expect(useAppStore.getState().bannerTone).toBe('info');
    expect(useAppStore.getState().saveError).toBeNull();

    await vi.advanceTimersByTimeAsync(INFO_NOTICE_MS);
    expect(useAppStore.getState().banner).toBeNull();
    expect(useAppStore.getState().bannerTone).toBe('danger');
  });

  it('写入失败留下错误横幅和保存失败，修好之后两者一起消失', async () => {
    const fs = new FailOnDemand();
    await useAppStore.getState().openVault(new Vault('验收', fs));
    await useAppStore.getState().createNote('验收来源');
    const path = '验收来源.md';
    fs.fail = true;
    useAppStore.getState().updateContent(path, '# 验收来源\n\n还没写上。\n');
    await useAppStore.getState().saveActive();

    const failed = useAppStore.getState();
    expect(failed.saveError).toBe('磁盘已满');
    expect(failed.banner).toBe('磁盘已满');
    expect(failed.bannerTone).toBe('danger');
    expect(
      saveStatusLabel({
        hasNote: true,
        dirty: true,
        saveError: failed.saveError,
      }),
    ).toBe('保存失败');

    publishNotice('新笔记：验收来源.md', 'info');
    expect(useAppStore.getState().banner).toBe('磁盘已满');
    expect(useAppStore.getState().bannerTone).toBe('danger');

    fs.fail = false;
    useAppStore.getState().updateContent(path, '# 验收来源\n\n写上了。\n');
    await useAppStore.getState().saveActive();
    const saved = useAppStore.getState();
    expect(saved.saveError).toBeNull();
    expect(saved.banner).toBeNull();
    expect(await fs.readText(path)).toContain('写上了');
    expect(
      saveStatusLabel({
        hasNote: true,
        dirty: saved.tabs.find((tab) => tab.path === path)?.dirty ?? true,
        saveError: saved.saveError,
      }),
    ).toBe('已保存');
  });

  it('关闭提示，并在重新打开库时清掉', async () => {
    await useAppStore.getState().openVault(new Vault('验收', new MemoryFileSystem()));
    publishNotice('磁盘已满', 'danger');
    expect(useAppStore.getState().bannerTone).toBe('danger');
    useAppStore.getState().setBanner(null);
    expect(useAppStore.getState().banner).toBeNull();

    publishNotice('新笔记：验收来源.md', 'info');
    expect(useAppStore.getState().bannerTone).toBe('info');
    await useAppStore.getState().openVault(new Vault('另一个', new MemoryFileSystem()));
    expect(useAppStore.getState().banner).toBeNull();
    expect(useAppStore.getState().vault?.name).toBe('另一个');
  });

  it('普通提示的归并不覆盖错误', () => {
    expect(
      nextNotice({ banner: '磁盘已满', bannerTone: 'danger' }, '新笔记：验收来源.md', 'info'),
    ).toEqual({ banner: '磁盘已满', bannerTone: 'danger' });
    expect(nextNotice({ banner: '新笔记：验收来源.md', bannerTone: 'info' }, null)).toEqual({
      banner: null,
      bannerTone: 'danger',
    });
  });
});
