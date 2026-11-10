import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WelcomeScreen } from './WelcomeScreen';

function markup(mode: 'first-run' | 'library', hint: string | null = null): string {
  return renderToStaticMarkup(
    <WelcomeScreen
      mode={mode}
      hint={hint}
      onOpenSample={() => undefined}
      onOpenFolder={() => undefined}
    />,
  );
}

describe('welcome screen', () => {
  it('puts the sample vault first on a first launch', () => {
    const html = markup('first-run', '没有连上本机 Ollama。可以先打开示例库。');
    expect(html.indexOf('打开示例库')).toBeLessThan(html.indexOf('打开本地文件夹'));
    expect(html).toContain('class="button primary welcome-primary"');
    expect(html).toContain('推荐');
    expect(html).toContain('不用注册');
    expect(html).toContain('没有连上本机 Ollama');
    expect(html).not.toContain('disabled');
  });

  it('keeps the existing library picker after a vault or saved settings', () => {
    const html = markup('library');
    expect(html.indexOf('打开文件夹')).toBeLessThan(html.indexOf('打开示例库'));
    expect(html).toContain('class="button primary"');
    expect(html).not.toContain('welcome-primary');
    expect(html).not.toContain('第一次使用');
    expect(html).not.toContain('disabled');
  });

  it('shows a detected Ollama model without blocking either entry', () => {
    const html = markup(
      'first-run',
      '已连上本机 Ollama，已写入模型设置：提供方 Ollama，模型 llama3.2，API Key 留空。',
    );
    expect(html).toContain('llama3.2');
    expect(html).toContain('API Key 留空');
    expect(html).toContain('打开示例库');
    expect(html).toContain('打开本地文件夹');
  });
});
