'use client';

import { AlertDialog } from '@base-ui/react';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'confirmar',
  variant = 'danger',
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-2xl">
          <AlertDialog.Title className="text-sm font-semibold text-foreground">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1.5 text-xs text-muted-foreground">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <AlertDialog.Close
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-elev transition-colors"
            >
              cancelar
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                variant === 'danger'
                  ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25'
                  : 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
