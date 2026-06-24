import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, asc, or, sql } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { AssignmentEditRow } from '@/components/uni/AssignmentEditRow';
import { ScheduleEditor } from '@/components/uni/ScheduleEditor';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToSubject, rowToAssignment } from '@/lib/today';
import { isUniDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarContainerPageContent } from '@/components/pillars/PillarContainerPageContent';
import { UNI_TEMPLATE } from '@/lib/pillar-templates';
import type { ScheduleSlot } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAY_LABELS: Record<string, string> = {
  mon: 'lunes', tue: 'martes', wed: 'miércoles', thu: 'jueves', fri: 'viernes', sat: 'sábado', sun: 'domingo',
};

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const user = await requireUser();
  const { subject } = await params;

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  if (isUniDynamicEngineEnabled()) {
    return <DynamicSubjectPage userId={user.id} subjectParam={subject} />;
  }

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
            vault: studies/{s.vault_slug}
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

// Dynamic-engine path. The URL param can be either a pillar_items id (a
// subject created after cutover) or the original subjects.id (a
// bookmarked pre-cutover URL) — matching on fields.legacy_id keeps old
// links working permanently, same pattern as /freelance/[client]. Note:
// this drill-down only renders the assignment list (GenericList) — the
// weekly schedule editor stays on the legacy route only, a known gap (see
// docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts).
async function DynamicSubjectPage({ userId, subjectParam }: { userId: string; subjectParam: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, UNI_TEMPLATE.key)))
    .limit(1);
  if (!pillarRow) notFound();
  const pillar = rowToPillar(pillarRow);

  const [containerRow] = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.pillar_id, pillar.id),
      eq(schema.pillarItems.user_id, userId),
      eq(schema.pillarItems.is_container, true),
      or(
        eq(schema.pillarItems.id, subjectParam),
        sql`${schema.pillarItems.fields}->>'legacy_id' = ${subjectParam}`,
      ),
    ))
    .limit(1);
  if (!containerRow) notFound();
  const container = rowToPillarItem(containerRow);

  const childRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(eq(schema.pillarItems.parent_item_id, container.id), eq(schema.pillarItems.user_id, userId)))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const children = childRows.map(rowToPillarItem);

  return (
    <PillarContainerPageContent
      pillar={pillar}
      container={container}
      children={children}
      basePath="/uni"
      childLabel="nuevo TP"
    />
  );
}
