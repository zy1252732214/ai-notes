import { installPluginFiles, type PluginStorage } from '@ai-notes/plugin-host';
import helloMain from '../../../../packages/plugin-sdk/examples/hello-notes/main.js?raw';
import helloManifest from '../../../../packages/plugin-sdk/examples/hello-notes/manifest.json?raw';

/** 笔记库里还没有 hello-notes 时，放进 `.ainotes/plugins/hello-notes`。 */
export async function ensureHelloNotes(storage: PluginStorage): Promise<void> {
  const existing = await storage.read('plugins/hello-notes/manifest.json');
  if (existing !== null) return;
  await installPluginFiles(storage, 'hello-notes', {
    'manifest.json': helloManifest,
    'main.js': helloMain,
  });
}
