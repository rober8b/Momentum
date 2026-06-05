'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, GraduationCap, Briefcase, Megaphone, FolderKanban, Users, LogOut } from 'lucide-react';
import { ExportButton } from './ExportButton';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Today', icon: LayoutGrid },
  { href: '/uni', label: 'Uni', icon: GraduationCap },
  { href: '/work', label: 'Work', icon: Briefcase },
  { href: '/freelance', label: 'Freelance', icon: FolderKanban },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/community', label: 'Comunidad', icon: Users },
  { href: '/build', label: 'Build', icon: Megaphone },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // En /login no mostramos el shell.
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-6 py-6">
          <Link href="/" className="block">
            <span className="font-mono text-sm text-muted-foreground">command</span>
            <h1 className="font-sans text-lg font-semibold">center</h1>
          </Link>
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
            <span className="text-xs text-muted-foreground font-mono">v0.1</span>
          </div>
          <ExportButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <Link href="/" className="font-semibold">
          command·center
        </Link>
        <a
          href="/logout"
          className="text-xs text-muted-foreground hover:text-danger"
          title="Cerrar sesión"
        >
          <LogOut size={14} />
        </a>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-surface">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 flex flex-col items-center gap-1 px-3 py-3 text-[10px]',
                active ? 'text-accent' : 'text-muted-foreground',
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main */}
      <main className="flex-1 lg:pt-0 pt-14 pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
