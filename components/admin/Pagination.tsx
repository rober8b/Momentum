import Link from 'next/link';
import { cn } from '@/lib/cn';

type Props = {
  basePath: string;
  page: number;
  totalPages: number;
  // Extra query params to preserve across page navigation (e.g. filters).
  query?: Record<string, string | undefined>;
};

function hrefFor(basePath: string, page: number, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) params.set(k, v);
    }
  }
  params.set('page', String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({ basePath, page, totalPages, query }: Props) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const linkCls = 'rounded-md border border-border px-3 py-1.5 text-xs transition-colors';
  const enabled = 'text-foreground hover:bg-surface-elev';
  const disabled = 'pointer-events-none opacity-40 text-muted-foreground';

  return (
    <div className="flex items-center justify-between pt-2">
      <Link
        href={hrefFor(basePath, page - 1, query)}
        aria-disabled={!hasPrev}
        tabIndex={hasPrev ? undefined : -1}
        className={cn(linkCls, hasPrev ? enabled : disabled)}
      >
        anterior
      </Link>
      <span className="text-xs text-muted-foreground">
        página {page} de {totalPages}
      </span>
      <Link
        href={hrefFor(basePath, page + 1, query)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={cn(linkCls, hasNext ? enabled : disabled)}
      >
        siguiente
      </Link>
    </div>
  );
}
