import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ai-notes/ui/components.css';
import { App } from './App';
import { applyTheme } from './theme';
import { useAppStore } from './store';
import './styles.css';

applyTheme(useAppStore.getState().themeMode);

const root = document.getElementById('root');
if (!root) throw new Error('找不到根节点');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
