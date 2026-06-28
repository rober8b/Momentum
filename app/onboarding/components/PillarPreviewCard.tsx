'use client';

import { useState } from 'react';
import {
  Briefcase,
  Rocket,
  Users,
  GraduationCap,
  Megaphone,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { PILLAR_TEMPLATES } from '@/lib/pillar-templates';
import type { ProposedItem, ProposedPillar } from '../types';
import { ItemRow } from './ItemRow';

// ---------- icon map ----------

function PillarIcon({ templateKey }: { templateKey: string }) {
  const map: Record<string, React.ReactNode> = {
    work:      <Briefcase size={13} />,
    freelance: <Briefcase size={13} />,
    projects:  <Rocket size={13} />,
    community: <Users size={13} />,
    uni:       <GraduationCap size={13} />,
    build:     <Megaphone size={13} />,
  };
  return <>{map[templateKey] ?? null}</>;
}

// ---------- default seeds for new items added by the user ----------

function defaultLeaf(templateKey: string): ProposedItem {
  const byKey: Record<string, Pick<ProposedItem, 'status' | 'fields'>> = {
    work:      { status: 'backlog', fields: { type: 'task', priority: 'med' } },
    projects:  { status: 'active',  fields: { next_step: 'definir próximo paso', last_update: '' } },
    build:     { status: 'idea',    fields: { platforms: ['x'], type: 'opinion' } },
    community: { status: 'pending', fields: {} },
    uni:       { status: 'todo',    fields: {} },
    freelance: { status: 'backlog', fields: { priority: 'med' } },
  };
  const base = byKey[templateKey] ?? { status: 'backlog', fields: {} };
  return { title: 'nuevo item', ...base, is_container: false, children: [] };
}

function defaultContainer(templateKey: string): ProposedItem {
  const y = new Date().getFullYear();
  const sem = new Date().getMonth() < 6 ? 1 : 2;
  const byKey: Record<string, Pick<ProposedItem, 'status' | 'fields'>> = {
    uni:       { status: 'active', fields: { semester: `${y}-${sem}`, schedule: [] } },
    freelance: { status: 'active', fields: { stack: '', next_step: 'definir alcance inicial' } },
    community: { status: 'active', fields: { slug: '' } },
  };
  const base = byKey[templateKey] ?? { status: 'active', fields: {} };
  return { title: '', ...base, is_container: true, children: [] };
}

// ---------- add-label helpers ----------

const CONTAINER_LABELS: Record<string, string> = {
  uni:       'materia',
  freelance: 'cliente',
  community: 'organización',
};

const CHILD_LABELS: Record<string, string> = {
  uni:       'tarea',
  freelance: 'tarea',
  community: 'compromiso',
};

// ---------- component ----------

type AddingTo = 'root' | number | null;

type Props = {
  pillar: ProposedPillar;
  onChange: (updated: ProposedPillar | null) => void;
};

export function PillarPreviewCard({ pillar, onChange }: Props) {
  const template = PILLAR_TEMPLATES[pillar.templateKey];
  const isHierarchical = pillar.items.some((i) => i.is_container);

  const [items, setItems] = useState<ProposedItem[]>(pillar.items);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(pillar.items.map((_, i) => i)));
  const [deleting, setDeleting] = useState(false);
  const [addingTo, setAddingTo] = useState<AddingTo>(null);
  const [addTitle, setAddTitle] = useState('');

  function push(next: ProposedItem[]) {
    setItems(next);
    onChange({ ...pillar, items: next });
  }

  // --- flat mutations ---
  function updateLeaf(idx: number, updated: ProposedItem | null) {
    push(updated === null ? items.filter((_, i) => i !== idx) : items.map((it, i) => (i === idx ? updated : it)));
  }

  // --- hierarchical mutations ---
  function updateContainer(idx: number, updated: ProposedItem | null) {
    if (updated === null) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(idx); return s; });
    }
    push(updated === null ? items.filter((_, i) => i !== idx) : items.map((it, i) => (i === idx ? updated : it)));
  }

  function updateChild(containerIdx: number, childIdx: number, updated: ProposedItem | null) {
    push(
      items.map((it, i) => {
        if (i !== containerIdx) return it;
        const children =
          updated === null
            ? it.children.filter((_, j) => j !== childIdx)
            : it.children.map((c, j) => (j === childIdx ? updated : c));
        return { ...it, children };
      }),
    );
  }

  function renameContainer(idx: number, title: string) {
    updateContainer(idx, { ...items[idx], title });
  }

  // --- add flow ---
  function commitAdd() {
    const t = addTitle.trim();
    setAddingTo(null);
    setAddTitle('');
    if (!t) return;

    if (addingTo === 'root') {
      if (isHierarchical) {
        const c = { ...defaultContainer(pillar.templateKey), title: t };
        const nextIdx = items.length;
        setExpanded((prev) => new Set([...prev, nextIdx]));
        push([...items, c]);
      } else {
        push([...items, { ...defaultLeaf(pillar.templateKey), title: t }]);
      }
    } else if (typeof addingTo === 'number') {
      push(
        items.map((it, i) => {
          if (i !== addingTo) return it;
          return { ...it, children: [...it.children, { ...defaultLeaf(pillar.templateKey), title: t }] };
        }),
      );
    }
  }

  const addRootLabel = isHierarchical
    ? `+ agregar ${CONTAINER_LABELS[pillar.templateKey] ?? 'grupo'}`
    : '+ agregar item';

  const addChildLabel = `+ agregar ${CHILD_LABELS[pillar.templateKey] ?? 'item'}`;

  if (!template) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-elev overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="text-muted-foreground">
          <PillarIcon templateKey={pillar.templateKey} />
        </span>
        <span className="flex-1 text-sm font-medium">{template.name}</span>

        {deleting ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">¿eliminar pillar?</span>
            <button
              onClick={() => onChange(null)}
              className="text-danger hover:text-foreground transition-colors font-medium"
            >
              sí
            </button>
            <button
              onClick={() => setDeleting(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              no
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleting(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="eliminar pillar"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* body */}
      <div className="px-3 py-2 space-y-0.5">
        {isHierarchical
          ? items.map((container, ci) => (
              <div key={ci} className="space-y-0.5">
                {/* container row */}
                <div className="flex items-center gap-1.5 group min-h-[28px]">
                  <button
                    onClick={() =>
                      setExpanded((prev) => {
                        const s = new Set(prev);
                        s.has(ci) ? s.delete(ci) : s.add(ci);
                        return s;
                      })
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {expanded.has(ci) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>

                  <ContainerTitle
                    title={container.title}
                    onRename={(t) => renameContainer(ci, t)}
                  />

                  <button
                    onClick={() => updateContainer(ci, null)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="eliminar"
                  >
                    <span className="text-xs">×</span>
                  </button>
                </div>

                {/* children */}
                {expanded.has(ci) && (
                  <div className="space-y-0.5 pb-1">
                    {container.children.map((child, ki) => (
                      <ItemRow
                        key={ki}
                        item={child}
                        indent
                        onChange={(updated) => updateChild(ci, ki, updated)}
                      />
                    ))}

                    {/* add child inline input */}
                    {addingTo === ci ? (
                      <div className="pl-5">
                        <input
                          autoFocus
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          onBlur={commitAdd}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitAdd();
                            if (e.key === 'Escape') { setAddingTo(null); setAddTitle(''); }
                          }}
                          placeholder={`nueva ${CHILD_LABELS[pillar.templateKey] ?? 'item'}…`}
                          className="w-full text-sm bg-transparent border-b border-accent outline-none py-0.5 text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(ci); setAddTitle(''); }}
                        className="pl-5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {addChildLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          : items.map((item, idx) => (
              <ItemRow key={idx} item={item} onChange={(u) => updateLeaf(idx, u)} />
            ))}
      </div>

      {/* add at root */}
      <div className="px-3 pb-2.5">
        {addingTo === 'root' ? (
          <input
            autoFocus
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') { setAddingTo(null); setAddTitle(''); }
            }}
            placeholder={
              isHierarchical
                ? `nombre de ${CONTAINER_LABELS[pillar.templateKey] ?? 'grupo'}…`
                : 'nuevo item…'
            }
            className="w-full text-sm bg-transparent border-b border-accent outline-none py-0.5 text-foreground placeholder:text-muted-foreground"
          />
        ) : (
          <button
            onClick={() => { setAddingTo('root'); setAddTitle(''); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {addRootLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- container title with inline edit ----------

function ContainerTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function commit() {
    const t = draft.trim();
    if (t) onRename(t);
    else setDraft(title);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(title); setEditing(false); }
        }}
        className="flex-1 text-sm bg-transparent border-b border-accent outline-none py-0.5 font-medium text-foreground"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex-1 text-left text-sm font-medium text-foreground hover:text-accent transition-colors truncate"
    >
      {title || <span className="text-muted-foreground italic">sin nombre</span>}
    </button>
  );
}
