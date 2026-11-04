/** 可释放的注册项。重复调用 dispose 应当是安全的。 */
export interface Disposable {
  dispose(): void;
}

export function disposable(dispose: () => void): Disposable {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    },
  };
}

/**
 * 插件在 onload 里登记的命令、视图、订阅都放进这里。
 * 宿主在 onunload 返回之后调用 dispose。
 */
export class DisposableStore implements Disposable {
  private readonly items: Disposable[] = [];
  private disposed = false;

  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }
    this.items.push(item);
    return item;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const items = this.items.splice(0);
    let failure: unknown;
    for (const item of items) {
      try {
        item.dispose();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure !== undefined) {
      throw failure;
    }
  }
}
