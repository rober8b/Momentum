'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ToastItem } from '@/lib/hooks/useToast';

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const STYLE = {
  success: 'border-success/30 text-success',
  error: 'border-danger/30 text-danger',
  info: 'border-accent/30 text-accent',
} as const;

export function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = ICON[item.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm shadow-lg',
        STYLE[item.type],
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1 text-foreground">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
