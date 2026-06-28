import { Fragment } from 'react';
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

const PILLAR_PREVIEWS = [
  { icon: LayoutGrid, name: 'today', count: 8, featured: true },
  { icon: GraduationCap, name: 'uni', count: 3, featured: false },
  { icon: Briefcase, name: 'work', count: 5, featured: false },
  { icon: FolderKanban, name: 'freelance', count: 2, featured: false },
  { icon: Rocket, name: 'projects', count: 4, featured: false },
  { icon: Users, name: 'community', count: 1, featured: false },
  { icon: Megaphone, name: 'build', count: 3, featured: false },
];

function PillarPreview() {
  return (
    <div className="relative w-full max-w-[272px]">
      {/* Ambient glow */}
      <div className="absolute -inset-6 rounded-3xl bg-accent/5 blur-3xl" />
      {/* Card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_48px_-12px_oklch(0_0_0/0.5)]">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              hoy
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">27 jun</span>
        </div>
        {/* Pillar rows */}
        <div className="p-2">
          {PILLAR_PREVIEWS.map(({ icon: Icon, name, count, featured }, i) => (
            <Fragment key={name}>
              {i === 1 && <div className="mx-1 my-1.5 border-t border-border/40" />}
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${featured ? 'bg-accent/10' : ''}`}
              >
                <Icon
                  size={13}
                  strokeWidth={featured ? 2 : 1.5}
                  className={featured ? 'text-accent' : 'text-muted-foreground'}
                />
                <span
                  className={`flex-1 font-mono text-xs ${
                    featured ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {name}
                </span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    featured ? 'text-accent' : 'text-muted-foreground/50'
                  }`}
                >
                  {count}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
        {/* Fade mask — implies more content below */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-xl bg-gradient-to-t from-surface to-transparent" />
      </div>
    </div>
  );
}

function TerminalLine({
  command,
  comment,
}: {
  command?: string;
  comment?: string;
}) {
  if (comment) return <p className="text-muted-foreground/50">{comment}</p>;
  return (
    <p className="flex gap-2">
      <span className="select-none text-accent/60">$</span>
      <span className="text-foreground/75">{command}</span>
    </p>
  );
}

function TerminalWindow() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background font-mono text-xs leading-relaxed">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border/50 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-danger/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-warning/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-success/50" />
        <span className="ml-auto text-[10px] text-muted-foreground">bash</span>
      </div>
      {/* Commands */}
      <div className="space-y-1.5 p-5">
        <TerminalLine command="git clone https://github.com/rober8b/Momentum" />
        <TerminalLine command="cd Momentum && cp .env.example .env.local" />
        <TerminalLine comment="# set DATABASE_URL · AUTH_SECRET · APP_URL" />
        <TerminalLine command="npm install && npm run db:migrate:local" />
        <TerminalLine command="npm run dev" />
        <p className="pt-1 text-success/70">▲ ready · localhost:3000</p>
      </div>
    </div>
  );
}

export function PublicLanding() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-heading text-base font-bold tracking-tight text-accent">
            momentum
          </span>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-elev px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-border active:scale-[0.98]"
          >
            login <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero — left-aligned, two-column */}
        <section className="grid items-center gap-12 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          {/* Left: content */}
          <div className="animate-slide-up">
            <p className="mb-5 font-mono text-xs uppercase tracking-widest text-accent">
              open source
            </p>
            <h1 className="mb-5 font-heading text-6xl font-bold leading-none tracking-tighter sm:text-7xl">
              momentum
            </h1>
            <p className="mb-10 max-w-sm text-xl leading-snug text-muted-foreground">
              seven contexts. one dashboard.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/rober8b/Momentum"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent active:scale-[0.98]"
              >
                <GitFork size={15} />
                ver código
              </a>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
              >
                entrar <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          {/* Right: pillar preview — hidden on mobile */}
          <div className="hidden justify-end md:flex animate-slide-up [animation-delay:100ms]">
            <PillarPreview />
          </div>
        </section>

        {/* What's inside */}
        <section className="mb-20">
          <h2 className="mb-8 animate-slide-up text-center text-xl font-semibold">what&apos;s inside</h2>

          {/* Today — featured card */}
          {(() => {
            const today = PILLARS[0];
            const TodayIcon = today.icon;
            return (
              <div className="mb-3 rounded-lg border border-accent/25 bg-surface p-5 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_4px_16px_-4px_rgba(255,64,0,0.15)] animate-slide-up [animation-delay:60ms]">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10">
                    <TodayIcon size={16} className="text-accent" />
                  </div>
                  <span className="font-medium">{today.name}</span>
                  <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
                    hub
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {today.description} Pulls from every pillar so you start each day from context, not from memory.
                </p>
              </div>
            );
          })()}

          {/* Remaining 6 pillars — 2-col grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {PILLARS.slice(1).map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.name}
                  style={{ animationDelay: `${120 + i * 50}ms` }}
                  className="animate-slide-up rounded-lg border border-border bg-surface p-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_4px_16px_-4px_rgba(255,64,0,0.12)]"
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10">
                      <Icon size={14} className="text-accent" />
                    </div>
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

        {/* Self-host */}
        <section className="mb-20">
          <div className="animate-slide-up grid overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[2fr_3fr]">
            {/* Left: text */}
            <div className="flex flex-col justify-center p-8 md:p-10">
              <h2 className="mb-3 text-xl font-semibold">self-host it</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Next.js 16, Drizzle ORM, Railway Postgres, Tailwind v4. Clone, set three env vars, push to Vercel. Under ten minutes.
              </p>
              <a
                href="https://github.com/rober8b/Momentum"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent active:scale-[0.98]"
              >
                <GitFork size={14} />
                github.com/rober8b/Momentum
              </a>
            </div>
            {/* Right: terminal */}
            <div className="border-t border-border p-6 md:border-l md:border-t-0 md:p-8">
              <TerminalWindow />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 sm:flex-row">
          <span className="font-mono text-xs text-muted-foreground">momentum</span>
          <a
            href="https://github.com/rober8b/Momentum"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            mit license · github →
          </a>
        </div>
      </footer>
    </div>
  );
}
