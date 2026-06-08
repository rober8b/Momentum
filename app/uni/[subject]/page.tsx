import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, asc } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { AssignmentEditRow } from '@/components/uni/AssignmentEditRow';
import { ScheduleEditor } from '@/components/uni/ScheduleEditor';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToSubject, rowToAssignment } from '@/lib/today';
import type { ScheduleSlot } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAY_LABELS: Record<string, string> = {
  mon: 'lunes', tue: 'martes', wed: 'miércoles', thu: 'jueves', fri: 'viernes', sat: 'sábado', sun: 'domingo',
};

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const user = await requireUser();
  const { subject } = await params;

  const [subjectRows, assignmentsRows] = await Promise.all([
    db.select().from(schema.subjects).where(and(eq(schema.subjects.id, subject), eq(schema.subjects.user_id, user.id))).limit(1),
    db
      .select()
      .from(schema.assignments)
      .where(and(eq(schema.assignments.subject_id, subject), eq(schema.assignments.user_id, user.id)))
      .orderBy(asc(schema.assignments.due_date)),
  ]);

  if (!subjectRows.length) notFound();

  const s = rowToSubject(subjectRows[0]);
  const assignments = assignmentsRows.map(rowToAssignment);
  const active = assignments.filter((a) => a.status !== 'done');
  const done = assignments.filter((a) => a.status === 'done');
  const schedule = s.schedule as ScheduleSlot[];

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Link
        href="/uni"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> agenda
      </Link>

      <div className="mb-6">
        <Badge variant="muted">{s.semester}</Badge>
        <h1 className="text-2xl lg:text-3xl font-semibold mt-2">{s.name}</h1>
        {s.vault_slug && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            vault: 20-studies/ucema/{s.vault_slug}.md
          </p>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>horarios</CardTitle>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground mb-3">
              no hay horarios cargados todavía.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {schedule.map((slot, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-surface-elev p-2.5 flex items-center justify-between"
                >
                  <span className="text-sm capitalize">{DAY_LABELS[slot.day]}</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {slot.start}–{slot.end}
                    {slot.room && ` · ${slot.room}`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <ScheduleEditor subjectId={s.id} currentSchedule={schedule} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>TPs activos ({active.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">sin TPs activos.</p>
          ) : (
            <div className="space-y-2">
              {active.map((a) => (
                <AssignmentEditRow key={a.id} assignment={{ ...a, subjectName: s.name }} tz={user.settings.timezone} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>completados ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.map((a) => (
                <AssignmentEditRow key={a.id} assignment={{ ...a, subjectName: s.name }} tz={user.settings.timezone} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
