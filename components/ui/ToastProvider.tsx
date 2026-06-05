'use client';

import { ToastContext, useToastState } from '@/lib/hooks/useToast';
import { Toast } from './Toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const state = useToastState();

  return (
    <ToastContext value={state}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
        {state.toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => state.dismiss(t.id)} />
        ))}
      </div>
    </ToastContext>
  );
}
