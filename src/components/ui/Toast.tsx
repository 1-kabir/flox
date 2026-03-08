import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppStore } from '../../store';
import type { Toast as ToastType } from '../../store';

const TOAST_DURATION_MS = 5000;

const severityStyles: Record<ToastType['severity'], string> = {
  success: 'bg-green-900/90 border-green-700/60 text-green-100',
  warning: 'bg-yellow-900/90 border-yellow-700/60 text-yellow-100',
  error: 'bg-red-900/90 border-red-700/60 text-red-100',
};

const SeverityIcon: React.FC<{ severity: ToastType['severity'] }> = ({ severity }) => {
  const cls = 'w-4 h-4 shrink-0';
  if (severity === 'success') return <CheckCircle className={cls} />;
  if (severity === 'warning') return <AlertTriangle className={cls} />;
  return <XCircle className={cls} />;
};

interface ToastItemProps {
  toast: ToastType;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const removeToast = useAppStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm shadow-lg max-w-sm w-full pointer-events-auto ${severityStyles[toast.severity]}`}
    >
      <SeverityIcon severity={toast.severity} />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
