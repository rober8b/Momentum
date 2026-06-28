'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ProposedItem } from '../types';

type Props = {
  item: ProposedItem;
  onChange: (updated: ProposedItem | null) => void; // null = delete
  indent?: boolean;
};

export function ItemRow({ item, onChange, indent = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  function commit() {
    const t = draft.trim();
    if (t) onChange({ ...item, title: t });
    else setDraft(item.title);
    setEditing(false);
  }

  return (
    <div
      className={[
        'flex items-center gap-2 group min-h-[28px]',
        indent ? 'pl-5' : '',
      ].join(' ')}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(item.title);
              setEditing(false);
            }
          }}
          className="flex-1 text-sm bg-transparent border-b border-accent outline-none py-0.5 text-foreground"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm text-foreground hover:text-accent transition-colors py-0.5 truncate"
        >
          {item.title}
        </button>
      )}
      <button
        onClick={() => onChange(null)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
        aria-label="eliminar"
      >
        <X size={12} />
      </button>
    </div>
  );
}
