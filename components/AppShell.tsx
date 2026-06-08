'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, GraduationCap, Briefcase, Megaphone, FolderKanban, Rocket, Users, LogOut, MoreHorizontal, Settings } from 'lucide-react';
import { ExportButton } from './ExportButton';
import { SearchBar } from './search/SearchBar';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Today', icon: LayoutGrid },
  { href: '/uni', label: 'Uni', icon: GraduationCap },
  { href: '/work', label: 'Work', icon: Briefcase },
  { href: '/freelance', label: 'Freelance', icon: FolderKanban },
  { href: '/projects', label: 'Proyectos', icon: Rocket },
  { href: '/community', label: 'Comunidad', icon: Users },
  { href: '/build', label: 'Build', icon: Megaphone },
] as const;

const MOBILE_NAV = NAV.filter((i) => !['/projects', '/community'].includes(i.href));
const MORE_NAV = NAV.filter((i) => ['/projects', '/community'].includes(i.href));

export default function AppShell({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Sin shell en /login ni en la landing pública (/ sin sesión).
  if (pathname === '/login' || (pathname === '/' && !isAuthenticated)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-6 py-6">
          <Link href="/" className="block">
            <h1 className="font-sans text-lg font-semibold">momentum</h1>
          </Link>
        </div>

        <div className="px-3 mb-3">
          <SearchBar />
        </div>

        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-surface-elev text-foreground'
                        : 'text-muted-foreground hover:bg-surface-elev hover:text-foreground',
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <a
              href="/logout"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-danger transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={12} />
              salir
            </a>
            <div className="flex items-center gap-3">
              <Link
                href="/settings/api-tokens"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="API Tokens"
              >
                <Settings size={12} />
                api
              </Link>
              <span className="text-xs text-muted-foreground font-mono">v0.1</span>
            </div>
          </div>
          <ExportButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <Link href="/" className="font-semibold">
          momentum
        </Link>
        <a
          href="/logout"
          className="text-xs text-muted-foreground hover:text-danger"
          title="Cerrar sesión"
        >
          <LogOut size={14} />
        </a>
      </div>

      {/* Mobile bottom nav — 5 items + "más" */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-[10px]',
                active ? 'text-accent' : 'text-muted-foreground',
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
        <div className="relative flex-1 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 text-[10px]',
              MORE_NAV.some((i) => pathname.startsWith(i.href))
                ? 'text-accent'
                : 'text-muted-foreground',
            )}
          >
            <MoreHorizontal size={17} />
            más
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-full mb-2 right-0 z-50 w-40 rounded-lg border border-border bg-surface shadow-xl py-1">
                {MORE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                        active ? 'text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elev',
                      )}
                    >
                      <Icon size={14} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 lg:pt-0 pt-14 pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
