'use client';

import { Dialog } from '@base-ui/react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

// base-ui's render-prop hands back native HTML drag-event handler types
// (onDrag, onDragEnd, etc.), which collide with motion's own pointer-based
// drag-gesture handlers of the same name when spread onto motion.div. We
// don't use drag gestures here, so drop them rather than fight the types.
function omitNativeDragHandlers(props: object) {
  const { onDrag, onDragStart, onDragEnd, onDragEnter, onDragExit, onDragLeave, onDragOver, onDrop, ...rest } = props as Record<string, unknown>;
  return rest;
}

// Shared overlay for every pillar's "new item" form. Replaces the old
// inline-expanding-form pattern (a small button swapped for a tall <form>
// in the document flow, which shoved page content down). The trigger button
// stays put — this only renders the form, in a portal, above everything.
//
// Positioning mirrors ConfirmDialog (fixed + left/top 50% + centered), but
// centering is done via motion's own x/y (-50%) instead of a Tailwind
// translate class, because a CSS-class transform and a motion-animated
// transform (scale) on the same element fight over the same `transform`
// inline style — motion always wins, silently breaking the Tailwind half.
// Doing the centering through motion's x/y avoids that entirely.
export function FormDialog({ open, onClose, title, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          render={(props) => (
            <motion.div {...omitNativeDragHandlers(props)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} />
          )}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm max-h-[85dvh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-2xl"
          render={(props) => (
            <motion.div
              {...omitNativeDragHandlers(props)}
              initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              transition={{ duration: 0.2 }}
            />
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
            <Dialog.Close
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
              aria-label="cerrar"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
