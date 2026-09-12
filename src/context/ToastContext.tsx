import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { wrapper: string; icon: typeof CheckCircle2 }> = {
  success: { wrapper: 'border-emerald-500/30 bg-slate-900 text-emerald-400', icon: CheckCircle2 },
  error: { wrapper: 'border-rose-500/30 bg-slate-900 text-rose-400', icon: TriangleAlert },
  info: { wrapper: 'border-blue-500/30 bg-slate-900 text-blue-400', icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback<ToastContextValue['notify']>(
    (message, tone = 'success') => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 left-4 z-[2000] ml-auto flex max-w-sm flex-col gap-3"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { wrapper, icon: Icon } = TONE_STYLES[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'pointer-events-auto flex items-start gap-4 rounded-xl border p-4 shadow-2xl',
                  wrapper,
                )}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <p className="flex-grow text-sm font-bold text-slate-100">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 cursor-pointer text-slate-500 transition-colors hover:text-white"
                >
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
