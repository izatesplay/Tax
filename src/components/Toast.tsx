import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 duration-200 ${
        isSuccess
          ? 'bg-[#102A21] border-[#45D69B]/40 text-[#F4F7F5]'
          : isError
          ? 'bg-[#2A1014] border-red-500/40 text-[#F4F7F5]'
          : 'bg-[#102A21] border-[#183D30] text-[#F4F7F5]'
      }`}
    >
      <div className="flex items-center gap-2.5 truncate">
        {isSuccess ? (
          <CheckCircle2 size={20} className="text-[#45D69B] shrink-0" />
        ) : isError ? (
          <AlertCircle size={20} className="text-red-400 shrink-0" />
        ) : null}
        <span className="text-sm font-medium leading-relaxed truncate">
          {toast.message}
        </span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#A8B8AF] hover:text-[#F4F7F5] min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg cursor-pointer shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};
