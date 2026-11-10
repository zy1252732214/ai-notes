import {
  defaultAiSettings,
  hasSavedAiSettings,
  prefillAiSettings,
  type AiSettings,
  type KeyValueStore,
} from '../ai/settings';
import { detectLocalOllama, type OllamaDetection } from '../ai/ollamaDetect';

/** 打开过笔记库之后就不再把用户拉回首次引导。 */
export const VAULT_OPENED_KEY = 'ai-notes.vault-opened';

export type WelcomeMode = 'first-run' | 'library';

export interface OnboardingProbe {
  phase: 'idle' | 'checking' | 'done';
  detection: OllamaDetection | null;
  /** 这次检测是否写入了模型设置。已有设置时永远是 false。 */
  applied: boolean;
}

const idleProbe: OnboardingProbe = { phase: 'idle', detection: null, applied: false };

let probe: OnboardingProbe = idleProbe;
const listeners = new Set<() => void>();

export function welcomeMode(store: KeyValueStore): WelcomeMode {
  if (hasOpenedVault(store) || hasSavedAiSettings(store)) return 'library';
  return 'first-run';
}

export function hasOpenedVault(store: KeyValueStore): boolean {
  try {
    return store.getItem(VAULT_OPENED_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberVaultOpened(store?: KeyValueStore): void {
  const target = store ?? browserStore();
  if (!target) return;
  try {
    target.setItem(VAULT_OPENED_KEY, '1');
  } catch {
    // 隐私模式可能禁用本地存储。这次会话里库已经打开了。
  }
}

export function getOnboardingProbe(): OnboardingProbe {
  return probe;
}

export function subscribeOnboardingProbe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 测试用：清掉这次进程里的检测状态，不改存储。 */
export function resetOnboardingProbe(): void {
  probe = idleProbe;
  listeners.clear();
}

/**
 * 还没保存过模型设置时，探测本机 Ollama 并预填。
 * 同一页面只会探测一次。已有设置时不发请求。
 */
export async function beginOllamaOnboarding(
  store?: KeyValueStore,
  detect: () => Promise<OllamaDetection> = () => detectLocalOllama(),
): Promise<OnboardingProbe> {
  const target = store ?? browserStore();
  if (!target) {
    publish({ phase: 'done', detection: null, applied: false });
    return probe;
  }
  if (probe.phase !== 'idle') return probe;
  if (hasSavedAiSettings(target)) {
    publish({ phase: 'done', detection: null, applied: false });
    return probe;
  }
  publish({ phase: 'checking', detection: null, applied: false });
  let detection: OllamaDetection;
  try {
    detection = await detect();
  } catch {
    detection = {
      ok: false,
      baseUrl: defaultAiSettings.ollama.baseUrl,
      reason: 'unreachable',
    };
  }
  if (hasSavedAiSettings(target)) {
    publish({ phase: 'done', detection, applied: false });
    return probe;
  }
  const applied = await applyOllamaDetection(detection, target);
  publish({ phase: 'done', detection, applied });
  return probe;
}

export async function applyOllamaDetection(
  detection: OllamaDetection,
  store: KeyValueStore,
): Promise<boolean> {
  if (!detection.ok || !detection.chatModel) return false;
  if (hasSavedAiSettings(store)) return false;
  return prefillAiSettings(settingsFromDetection(detection, detection.chatModel), store);
}

export function settingsFromDetection(
  detection: Extract<OllamaDetection, { ok: true }>,
  chatModel: string,
): AiSettings {
  return {
    ...defaultAiSettings,
    provider: 'ollama',
    openai: { ...defaultAiSettings.openai, apiKey: '' },
    ollama: {
      baseUrl: detection.baseUrl,
      model: chatModel,
      apiKey: '',
    },
    embedModel: '',
  };
}

/** 给引导界面的一句状态。没有新信息时返回 null。 */
export function ollamaHint(state: OnboardingProbe): string | null {
  if (state.phase === 'checking') return '正在查看本机 Ollama…';
  if (state.phase !== 'done' || !state.detection) return null;
  const detection = state.detection;
  if (!detection.ok) {
    return '没有连上本机 Ollama。可以先打开示例库。要离线问答，请运行 ollama serve；浏览器预览还要设置 OLLAMA_ORIGINS（例如 http://localhost:1420）。';
  }
  if (!detection.chatModel) {
    return '本机 Ollama 已在运行，但还没有聊天模型。可以先打开示例库。需要问答时再执行 ollama pull llama3.2。这里不会自动下载。';
  }
  const wrote = state.applied ? '已写入模型设置' : '检测到模型';
  return `已连上本机 Ollama，${wrote}：提供方 Ollama，地址 ${detection.baseUrl}，模型 ${detection.chatModel}，API Key 留空。${embedSentence(detection.embedModel)}`;
}

function embedSentence(embedModel: string | null): string {
  if (!embedModel) return '嵌入模型留空，搜索仍用全文。';
  return `嵌入模型留空，搜索仍用全文。本机已有 ${embedModel}，可在模型设置里用作嵌入模型。`;
}

function publish(next: OnboardingProbe): void {
  probe = next;
  for (const listener of listeners) listener();
}

function browserStore(): KeyValueStore | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}
