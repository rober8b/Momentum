import Link from 'next/link';
import { and, asc, desc, eq } from 'drizzle-orm';
import { ScheduleGrid } from '@/components/uni/ScheduleGrid';
import { AssignmentRow } from '@/components/today/AssignmentRow';
import { AssignmentForm } from '@/components/uni/AssignmentForm';
import { SubjectForm } from '@/components/uni/SubjectForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToSubject, rowToAssignment } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function UniPage() {
  const user = await requireUser();

  const [subjectsRows, assignmentsRows] = await Promise.all([
    db
      .select()
      .from(schema.subjects)
      .where(and(eq(schema.subjects.active, true), eq(schema.subjects.user_id, user.id)))
      .orderBy(asc(schema.subjects.name)),
    db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.user_id, user.id))
      .orderBy(asc(schema.assignments.due_date)),
  ]);

  const subjects = subjectsRows.filter((s) => s.active).map(rowToSubject);
  const assignments = assignmentsRows.map(rowToAssignment);
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  const active = assignments
    .filter((a) => a.status !== 'done')
    .map((a) => ({ ...a, subjectName: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null }));
  const done = assignments
    .filter((a) => a.status === 'done')
    .map((a) => ({ ...a, subjectName: a.subject_id ? subjectMap.get(a.subject_id) ?? null : null }));

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

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>completados ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {done.slice(0, 10).map((a) => (
                <AssignmentRow key={a.id} assignment={a} tz={user.settings.timezone} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
