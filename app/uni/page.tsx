import Link from 'next/link';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { GraduationCap, Layers } from 'lucide-react';
import { ScheduleGrid } from '@/components/uni/ScheduleGrid';
import { AssignmentRow } from '@/components/today/AssignmentRow';
import { AssignmentForm } from '@/components/uni/AssignmentForm';
import { SubjectForm } from '@/components/uni/SubjectForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { t } from '@/lib/strings';
import { rowToSubject, rowToAssignment } from '@/lib/today';
import { isUniDynamicEngineEnabled } from '@/lib/pillar-flags';
import { rowToPillar, rowToPillarItem } from '@/lib/pillars';
import { PillarPageContent } from '@/components/pillars/PillarPageContent';
import { InstantiateTemplateButton } from '@/components/pillars/InstantiateTemplateButton';
import { UNI_TEMPLATE } from '@/lib/pillar-templates';

export const dynamic = 'force-dynamic';

const DONE_PAGE_SIZE = 20;

export default async function UniPage({
  searchParams,
}: {
  searchParams: Promise<{ donePage?: string }>;
}) {
  const user = await requireUser();

  // Rollback flag — see docs/DYNAMIC_PILLARS.md and lib/pillar-flags.ts.
  // Set UNI_DYNAMIC_ENGINE=false to fall back to the path below instantly.
  // subjects/assignments are never touched by the dynamic path, so flipping
  // this back and forth is always safe.
  if (isUniDynamicEngineEnabled()) {
    return <DynamicUniPage userId={user.id} />;
  }

  const { donePage: donePageParam } = await searchParams;
  const donePage = Math.max(1, Number.parseInt(donePageParam ?? '1', 10) || 1);
  const doneOffset = (donePage - 1) * DONE_PAGE_SIZE;

  const [subjectsRows, activeRows, doneRows, [{ count: doneCount }]] = await Promise.all([
    db
      .select()
      .from(schema.subjects)
      .where(and(eq(schema.subjects.active, true), eq(schema.subjects.user_id, user.id)))
      .orderBy(asc(schema.subjects.name)),
    db
      .select()
      .from(schema.assignments)
      .where(and(eq(schema.assignments.user_id, user.id), ne(schema.assignments.status, 'done')))
      .orderBy(asc(schema.assignments.due_date)),
    db
      .select()
      .from(schema.assignments)
      .where(and(eq(schema.assignments.user_id, user.id), eq(schema.assignments.status, 'done')))
      .orderBy(desc(schema.assignments.completed_at))
      .limit(DONE_PAGE_SIZE)
      .offset(doneOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.assignments)
      .where(and(eq(schema.assignments.user_id, user.id), eq(schema.assignments.status, 'done'))),
  ]);

  const subjects = subjectsRows.filter((s) => s.active).map(rowToSubject);
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  const active = activeRows
    .map(rowToAssignment)
    .map((a) => ({ ...a, subjectName: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null }));
  const done = doneRows
    .map(rowToAssignment)
    .map((a) => ({ ...a, subjectName: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null }));
  const doneTotalPages = Math.max(1, Math.ceil(doneCount / DONE_PAGE_SIZE));

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          uni
        </p>
        <h2 className="text-2xl lg:text-3xl font-semibold mt-1">agenda</h2>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {subjects.length} materias · {active.length} TPs activos
          </p>
          <SubjectForm />
        </div>
      </div>

      {subjects.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title={t('uniNoSubjects', user.settings.language)}
          description={t('uniNoSubjectsHint', user.settings.language)}
          action={<SubjectForm />}
        />
      )}

      {subjects.length > 0 && (<>
      <Card className="mb-6">
        <CardHeader><CardTitle>semana</CardTitle></CardHeader>
        <CardContent>
          <ScheduleGrid subjects={subjects} />
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Editar horarios desde el detalle de cada materia (
              {subjects.map((s, i) => (
                <span key={s.id}>
                  <Link href={`/uni/${s.id}`} className="text-accent hover:underline">
                    {s.name}
                  </Link>
                  {i < subjects.length - 1 ? ', ' : ''}
                </span>
              ))}
              )
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>TPs activos</CardTitle>
          <AssignmentForm subjects={subjects} />
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              no hay TPs activos.
            </p>
          ) : (
            <div className="space-y-2">
              {active.map((a) => (
                <AssignmentRow key={a.id} assignment={a} tz={user.settings.timezone} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {doneCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>completados ({doneCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.map((a) => (
                <AssignmentRow key={a.id} assignment={a} tz={user.settings.timezone} />
              ))}
            </div>
            <Pagination basePath="/uni" page={donePage} totalPages={doneTotalPages} paramName="donePage" />
          </CardContent>
        </Card>
      )}
      </>)}
    </div>
  );
}

// Dynamic-engine path: reads from pillars/pillar_items (subjects as
// containers, assignments as their children) instead of
// subjects/assignments. The weekly schedule renders via the registered
// 'uni-schedule' custom renderer, reading fields.schedule off each subject
// container item. See docs/DYNAMIC_PILLARS.md.
async function DynamicUniPage({ userId }: { userId: string }) {
  const [pillarRow] = await db
    .select()
    .from(schema.pillars)
    .where(and(eq(schema.pillars.user_id, userId), eq(schema.pillars.key, UNI_TEMPLATE.key)))
    .limit(1);

  if (!pillarRow) {
    return (
      <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
        <div className="mb-6 lg:mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">uni</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">agenda</h2>
        </div>
        <EmptyState
          icon={Layers}
          title="este pilar todavía no está activado"
          description="instanciá el template de uni para empezar a usar el motor dinámico."
          action={<InstantiateTemplateButton template={UNI_TEMPLATE} />}
        />
      </div>
    );
  }

  const pillar = rowToPillar(pillarRow);
  const itemRows = await db
    .select()
    .from(schema.pillarItems)
    .where(and(
      eq(schema.pillarItems.user_id, userId),
      eq(schema.pillarItems.pillar_id, pillar.id),
      isNull(schema.pillarItems.parent_item_id),
    ))
    .orderBy(schema.pillarItems.position, schema.pillarItems.created_at);
  const items = itemRows.map(rowToPillarItem);

  return <PillarPageContent pillar={pillar} items={items} eyebrow="uni" basePath="/uni" itemLabel="nueva materia" />;
}
