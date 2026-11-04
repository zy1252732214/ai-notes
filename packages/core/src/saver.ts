export interface DebouncedSaver {
  schedule(content: string): void;
  flush(): Promise<void>;
  cancel(): void;
  dispose(): void;
}

/**
 * 合并连续编辑，只把最后一版写入磁盘。
 * `flush` 会立刻写完待保存内容和已经在飞的写入。
 */
const timers = globalThis as typeof globalThis & {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export function createDebouncedSaver(
  save: (content: string) => Promise<void>,
  delayMs: number,
): DebouncedSaver {
  let timer: unknown;
  let pending: string | undefined;
  let chain: Promise<void> = Promise.resolve();
  let disposed = false;

  const enqueue = (content: string): Promise<void> => {
    const run = chain.then(() => save(content));
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const saver: DebouncedSaver = {
    schedule(content) {
      if (disposed) return;
      pending = content;
      if (timer !== undefined) timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = undefined;
        if (disposed || pending === undefined) return;
        const value = pending;
        pending = undefined;
        void enqueue(value).catch(() => {
          // 自动保存的失败由 save 自己记录；显式 flush 仍会抛出。
        });
      }, delayMs);
    },
    async flush() {
      if (disposed) return;
      if (timer !== undefined) {
        timers.clearTimeout(timer);
        timer = undefined;
      }
      if (pending !== undefined) {
        const value = pending;
        pending = undefined;
        await enqueue(value);
        return;
      }
      await chain;
    },
    cancel() {
      if (timer !== undefined) timers.clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
    dispose() {
      disposed = true;
      saver.cancel();
    },
  };

  return saver;
}
