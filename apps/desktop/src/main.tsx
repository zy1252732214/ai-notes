import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ai-notes/ui/components.css';
import { App } from './App';
import { installDesktopSecrets } from './ai/keychain';
import { installPluginBridge } from './plugins/controller';
import { applyTheme } from './theme';
import { useAppStore } from './store';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('找不到根节点');

void boot(root);

async function boot(host: HTMLElement) {
  installPluginBridge();
  applyTheme(useAppStore.getState().themeMode);
  await installDesktopSecrets();
  createRoot(host).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
