'use client';

import { createContext, useCallback, useContext, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastCtx = {
  toasts: ToastItem[];
  add: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastCtx>({
  toasts: [],
  add: () => {},
  dismiss: () => {},
});

let nextId = 0;

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, add, dismiss };
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    success: (msg: string) => ctx.add('success', msg),
    error: (msg: string) => ctx.add('error', msg),
    info: (msg: string) => ctx.add('info', msg),
  };
}
