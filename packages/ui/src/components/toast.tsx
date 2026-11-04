import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UiIcon } from '../icons.js';
import { cx } from '../lib.js';
import { IconButton } from './icon-button.js';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** 毫秒。`0` 表示一直留着，直到手动关闭。默认 4000。 */
  duration?: number;
}

interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
}

interface ToastApi {
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneLabel: Record<ToastTone, string> = {
  info: '提示',
  success: '成功',
  warning: '注意',
  danger: '错误',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const id = `an-toast-${nextId.current}`;
    const record: ToastRecord = {
      id,
      title: input.title,
      description: input.description,
      tone: input.tone ?? 'info',
      duration: input.duration ?? 4000,
    };
    setToasts((current) => [...current, record]);
    return id;
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="an-toast-viewport" aria-label="通知">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast 必须放在 ToastProvider 里面');
  return api;
}

function ToastView({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const assertive = toast.tone === 'danger';

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={cx('an-toast', `an-toast--${toast.tone}`)}
    >
      <div className="an-toast__text">
        <p className="an-toast__title">
          <span className="an-sr-only">{toneLabel[toast.tone]}：</span>
          {toast.title}
        </p>
        {toast.description ? <p className="an-toast__description">{toast.description}</p> : null}
      </div>
      <IconButton label="关闭通知" size="sm" onClick={() => onDismiss(toast.id)}>
        <UiIcon name="close" />
      </IconButton>
    </div>
  );
}
