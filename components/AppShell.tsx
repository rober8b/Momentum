'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, GraduationCap, Briefcase, Megaphone, FolderKanban, Rocket, Users, LogOut, MoreHorizontal, Settings, User, Shield, ChevronsUpDown } from 'lucide-react';
import { ExportButton } from './ExportButton';
import { SearchBar } from './search/SearchBar';
import { cn } from '@/lib/cn';
import pkg from '@/package.json';

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

// One source of truth for active highlighting across every render site.
// Root ('/') matches exactly; others match the segment or any sub-path.
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

// Shared row styling for the popup menus (desktop account dropdown + mobile "más").
function menuRowCls(active: boolean): string {
  return cn(
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-surface-elev text-foreground'
      : 'text-muted-foreground hover:bg-surface-elev hover:text-foreground',
  );
}

export default function AppShell({
  children,
  isAuthenticated,
  isAdmin,
  userLabel,
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  userLabel?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Sin shell en /login ni en la landing pública (/ sin sesión).
  if (pathname === '/login' || (pathname === '/' && !isAuthenticated)) {
    return <>{children}</>;
  }

  // Account / utility links — shared by the desktop dropdown and the mobile "más" menu.
  // admin is included only for admins (preserves the isAdmin gate).
  const accountLinks = [
    { href: '/settings/profile', label: 'perfil', icon: User },
    ...(isAdmin ? [{ href: '/admin', label: 'admin', icon: Shield }] : []),
    { href: '/settings/api-tokens', label: 'api tokens', icon: Settings },
  ] as const;

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
              const active = isActive(pathname, item.href);
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

        {/* Footer — account dropdown + version metadata */}
        <div className="border-t border-border p-3">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-expanded={accountOpen}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                accountOpen
                  ? 'bg-surface-elev text-foreground'
                  : 'text-muted-foreground hover:bg-surface-elev hover:text-foreground',
              )}
            >
              <User size={16} className="shrink-0" />
              <span className="flex-1 truncate text-left">{userLabel || 'cuenta'}</span>
              <ChevronsUpDown size={14} className="shrink-0 opacity-60" />
            </button>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60" title="versión">
              v{pkg.version}
            </span>

            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-lg border border-border bg-surface p-1 shadow-xl">
                  {accountLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAccountOpen(false)}
                        className={menuRowCls(isActive(pathname, item.href))}
                      >
                        <Icon size={15} />
                        {item.label}
                      </Link>
                    );
                  })}
                  <ExportButton
                    className="w-full gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-elev hover:text-foreground"
                    onDone={() => setAccountOpen(false)}
                  />
                  <div className="my-1 border-t border-border" />
                  <a
                    href="/logout"
                    className={cn(menuRowCls(false), 'hover:text-danger')}
                    title="Cerrar sesión"
                  >
                    <LogOut size={15} />
                    salir
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar — logo + one-tap logout */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <Link href="/" className="font-semibold">
          momentum
        </Link>
        <a
          href="/logout"
          className="text-muted-foreground hover:text-danger transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </a>
      </div>

      {/* Mobile bottom nav — 5 items + "más" */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
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
            aria-expanded={moreOpen}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] w-full',
              moreOpen || MORE_NAV.some((i) => isActive(pathname, i.href)) || accountLinks.some((i) => isActive(pathname, i.href))
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
              <div className="absolute bottom-full mb-2 right-0 z-50 w-48 rounded-lg border border-border bg-surface shadow-xl p-1">
                {/* app pages */}
                {MORE_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={menuRowCls(isActive(pathname, item.href))}
                    >
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="my-1 border-t border-border" />
                {/* account / utility */}
                {accountLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={menuRowCls(isActive(pathname, item.href))}
                    >
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
                <ExportButton
                  className="w-full gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-elev hover:text-foreground"
                  onDone={() => setMoreOpen(false)}
                />
                <div className="my-1 border-t border-border" />
                <div className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground/60">
                  v{pkg.version}
                </div>
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
