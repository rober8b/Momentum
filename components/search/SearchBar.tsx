'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { searchAll, type SearchResult } from '@/app/search/actions';

const TYPE_LABELS: Record<string, string> = {
  assignment: 'TP',
  workblock: 'work',
  build: 'build',
  'freelance-client': 'cliente',
  'freelance-task': 'freelance',
  project: 'proyecto',
  community: 'comunidad',
};

const TYPE_COLORS: Record<string, string> = {
  assignment: 'text-accent',
  workblock: 'text-warning',
  build: 'text-success',
  'freelance-client': 'text-accent',
  'freelance-task': 'text-accent',
  project: 'text-accent',
  community: 'text-muted-foreground',
};

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelected(0);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && open) {
        close();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, close]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAll(query);
        setResults(r);
        setSelected(0);
      });
    }, 250);
  }, [query]);

  function navigate(href: string) {
    close();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      navigate(results[selected].href);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:border-accent/50 transition-colors"
      >
        <Search size={12} />
        <span className="flex-1 text-left">buscar...</span>
        <kbd className="hidden lg:inline text-[10px] border border-border rounded px-1">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="fixed left-1/2 top-[15vh] z-50 w-[90vw] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="buscar en todos los pilares..."
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); }} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto py-2">
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(r.href)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-2 text-left transition-colors',
                  i === selected ? 'bg-surface-elev' : 'hover:bg-surface-elev',
                )}
              >
                <span className={cn('text-[10px] uppercase font-mono w-16 shrink-0', TYPE_COLORS[r.type])}>
                  {TYPE_LABELS[r.type]}
                </span>
                <span className="text-sm flex-1 truncate">{r.title}</span>
                {r.meta && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{r.meta}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !isPending && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            sin resultados para "{query}"
          </div>
        )}

        {isPending && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            buscando...
          </div>
        )}
      </div>
    </>
  );
}
