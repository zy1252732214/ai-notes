import { bindTheme, Button, ToastProvider, type ThemePreference } from '@ai-notes/ui';
import { useEffect, useState } from 'react';
import { previewSections } from './catalog';
import { PreviewSection } from './sections';

const themeOptions: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'system', label: '跟随系统' },
];

function readInitialTheme(): ThemePreference {
  const value = new URLSearchParams(window.location.search).get('theme');
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export function App() {
  const [preference, setPreference] = useState<ThemePreference>(readInitialTheme);
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const stop = bindTheme(preference, root);
    setResolved(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    return stop;
  }, [preference]);

  return (
    <ToastProvider>
      <div className="preview">
        <header className="preview-header">
          <div className="preview-brand">
            <p className="preview-kicker">ai-notes</p>
            <h1>组件预览</h1>
          </div>
          <div className="preview-theme" role="group" aria-label="主题">
            {themeOptions.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={preference === option.id ? 'primary' : 'ghost'}
                aria-pressed={preference === option.id}
                onClick={() => setPreference(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </header>
        <div className="preview-shell">
          <nav className="preview-nav" aria-label="组件">
            {previewSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
          <main className="preview-main">
            <p className="preview-lead">
              当前是{resolved === 'dark' ? '深色' : '浅色'}。颜色、字号、间距和圆角都来自{' '}
              <code>--an-*</code> 令牌。
            </p>
            {previewSections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="preview-section"
                aria-labelledby={`${section.id}-title`}
              >
                <div className="preview-section-head">
                  <h2 id={`${section.id}-title`}>{section.title}</h2>
                  <p>{section.summary}</p>
                </div>
                <PreviewSection id={section.id} />
              </section>
            ))}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
