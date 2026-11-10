import type { WelcomeMode } from '../onboarding/guide';

export function WelcomeScreen({
  mode,
  hint,
  onOpenSample,
  onOpenFolder,
}: {
  mode: WelcomeMode;
  hint: string | null;
  onOpenSample: () => void;
  onOpenFolder: () => void;
}) {
  if (mode === 'library') {
    return (
      <div className="empty-state">
        <h1>打开一个笔记库</h1>
        <p>选择一个文件夹作为 Vault。里面的 Markdown 文件会显示在左侧，编辑后写回磁盘。</p>
        <div className="empty-actions">
          <button className="button primary" type="button" onClick={onOpenFolder}>
            打开文件夹
          </button>
          <button className="button" type="button" onClick={onOpenSample}>
            打开示例库
          </button>
        </div>
        <p className="hint">示例库只在内存里，用来熟悉界面，不会写入磁盘。</p>
        {hint ? (
          <p className="welcome-note" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="empty-state welcome">
      <p className="welcome-kicker">第一次使用</p>
      <h1>先打开示例库</h1>
      <p>不用注册，也不需要 API Key。示例库在内存里，可以马上试编辑、搜索和问答，不会写入磁盘。</p>
      <div className="welcome-actions">
        <div className="welcome-primary-row">
          <button className="button primary welcome-primary" type="button" onClick={onOpenSample}>
            打开示例库
          </button>
          <span className="welcome-badge">推荐</span>
        </div>
        <button className="button" type="button" onClick={onOpenFolder}>
          打开本地文件夹
        </button>
      </div>
      <p className="hint">
        已经有笔记的话，用本地文件夹打开那个目录。浏览器里需要 Chrome 或 Edge。
      </p>
      {hint ? (
        <p className="welcome-note" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
