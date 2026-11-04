import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSaver } from './index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('debounced saver', () => {
  it('writes only the latest content after the delay', async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const saver = createDebouncedSaver(async (content) => {
      saved.push(content);
    }, 800);

    saver.schedule('a');
    saver.schedule('ab');
    await vi.advanceTimersByTimeAsync(799);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['ab']);
    saver.dispose();
  });

  it('flush writes immediately and does not write again when the timer would have fired', async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const saver = createDebouncedSaver(async (content) => {
      saved.push(content);
    }, 800);

    saver.schedule('草稿');
    await saver.flush();
    expect(saved).toEqual(['草稿']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toEqual(['草稿']);
    saver.dispose();
  });

  it('flush surfaces a failed write', async () => {
    const saver = createDebouncedSaver(async () => {
      throw new Error('磁盘已满');
    }, 800);
    saver.schedule('正文');
    await expect(saver.flush()).rejects.toThrow('磁盘已满');
    saver.dispose();
  });

  it('ignores schedules after dispose', async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const saver = createDebouncedSaver(async (content) => {
      saved.push(content);
    }, 10);
    saver.dispose();
    saver.schedule('晚了');
    await vi.advanceTimersByTimeAsync(50);
    expect(saved).toEqual([]);
  });
});
