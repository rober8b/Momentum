import Link from 'next/link';
import { ArrowRight, GraduationCap, Briefcase, Megaphone, FolderKanban, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ClassCard } from './ClassCard';
import { AssignmentRow } from './AssignmentRow';
import { TicketCard } from './TicketCard';
import { BuildPrompt } from './BuildPrompt';
import { formatFullDate } from '@/lib/date';
import type { TodayData } from '@/lib/today';

export function TodayDashboard({ data }: { data: TodayData }) {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            today
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold capitalize mt-1">
            {formatFullDate()}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {data.classes.length + data.assignments.length + data.workblocks.length + data.buildItems.length + data.freelanceTasks.length + data.communityItems.length} items pendientes
        </p>
      </div>

      {/* 3-column dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* UNIVERSIDAD */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              <GraduationCap size={14} className="inline mr-1.5 -mt-0.5" />
              hoy en la facu
            </CardTitle>
            <Link
              href="/uni"
              className="text-xs text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              ver todo <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 min-h-[400px]">
            {data.classes.length === 0 && data.assignments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                no hay clases ni TPs urgentes hoy.
              </p>
            )}
            {data.classes.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  clases
                </p>
                <div className="space-y-2">
                  {data.classes.map((c, i) => (
                    <ClassCard key={`${c.subject.id}-${i}`} item={c} />
                  ))}
                </div>
              </div>
            )}
            {data.assignments.length > 0 && (
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  TPs próximos
                </p>
                <div className="space-y-2">
                  {data.assignments.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TRABAJO */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              <Briefcase size={14} className="inline mr-1.5 -mt-0.5" />
              hoy en aleph
            </CardTitle>
            <Link
              href="/work"
              className="text-xs text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              kanban <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2 min-h-[400px]">
            {data.workblocks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                no hay workblocks activos.<br />
                <Link href="/work" className="text-accent hover:underline">
                  agregar uno →
                </Link>
              </p>
            )}
            {data.workblocks.map((w) => (
              <TicketCard key={w.id} workblock={w} />
            ))}
          </CardContent>
        </Card>

        {/* BUILD */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              <Megaphone size={14} className="inline mr-1.5 -mt-0.5" />
              build hoy
            </CardTitle>
            <Link
              href="/build"
              className="text-xs text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              tracker <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 min-h-[400px]">
            <BuildPrompt items={data.buildItems} />
          </CardContent>
        </Card>
      </div>

      {/* Compact strip: freelance + community */}
      {(data.freelanceTasks.length > 0 || data.communityItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mt-4 lg:mt-6">
          {data.freelanceTasks.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>
                  <FolderKanban size={14} className="inline mr-1.5 -mt-0.5" />
                  freelance activo
                </CardTitle>
                <Link
                  href="/freelance"
                  className="text-xs text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
                >
                  ver todo <ArrowRight size={10} />
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {data.freelanceTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-elev p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">{t.title}</p>
                        <span className="text-[10px] text-muted-foreground">{t.clientName}</span>
                      </div>
                      <span className="text-[10px] text-accent uppercase shrink-0">{t.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.communityItems.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>
                  <Users size={14} className="inline mr-1.5 -mt-0.5" />
                  compromisos proximos
                </CardTitle>
                <Link
                  href="/community"
                  className="text-xs text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
                >
                  ver todo <ArrowRight size={10} />
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {data.communityItems.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-elev p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">{c.title}</p>
                        <span className="text-[10px] text-muted-foreground">{c.organization}</span>
                      </div>
                      {c.due_date && (
                        <span className="text-[10px] text-warning shrink-0">{c.due_date}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
