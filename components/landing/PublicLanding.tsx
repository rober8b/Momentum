import Link from 'next/link';
import {
  LayoutGrid,
  GraduationCap,
  Briefcase,
  Megaphone,
  FolderKanban,
  Rocket,
  Users,
  GitFork,
  ArrowRight,
} from 'lucide-react';

const PILLARS = [
  {
    icon: LayoutGrid,
    name: 'Today',
    description: 'Daily operating view — assignments, tickets, and build queue in one place.',
  },
  {
    icon: GraduationCap,
    name: 'Uni',
    description: 'Subjects, schedules, and assignment tracking with resource links.',
  },
  {
    icon: Briefcase,
    name: 'Work',
    description: 'Kanban board for work tasks — backlog, in progress, blocked, done.',
  },
  {
    icon: FolderKanban,
    name: 'Freelance',
    description: 'Client roster with per-client task lists, status, and next steps.',
  },
  {
    icon: Rocket,
    name: 'Projects',
    description: 'Personal side projects tracked independently from client work.',
  },
  {
    icon: Users,
    name: 'Community',
    description: 'Commitments, events, and people you said yes to.',
  },
  {
    icon: Megaphone,
    name: 'Build',
    description: 'Ideas → drafts → published. Build-in-public pipeline for X and LinkedIn.',
  },
];

export function PublicLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <span className="font-sans text-sm font-semibold">momentum</span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-elev px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border"
          >
            login <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="py-20 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent">
            open source
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            momentum
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
            The organization platform for builders.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://github.com/rober8b/Momentum"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <GitFork size={15} />
              ver código
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              entrar <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* What's inside */}
        <section className="mb-20">
          <h2 className="mb-8 text-center text-xl font-semibold">what&apos;s inside</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.name}
                  className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={15} className="text-accent" />
                    <span className="text-sm font-medium">{pillar.name}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="mb-20 rounded-xl border border-border bg-surface p-10 text-center">
          <h2 className="mb-2 text-lg font-semibold">self-host it</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Next.js 16 · Drizzle ORM · Railway Postgres · Tailwind v4 · Vercel deploy.
            <br />
            Clone, configure three env vars, push. Done.
          </p>
          <a
            href="https://github.com/rober8b/Momentum"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <GitFork size={15} />
            github.com/rober8b/Momentum
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 sm:flex-row">
          <span className="font-mono text-xs text-muted-foreground">
            momentum
          </span>
          <a
            href="https://github.com/rober8b/Momentum"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            built with ♥ — MIT license →
          </a>
        </div>
      </footer>
    </div>
  );
}
