import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToAssignment, rowToSubject } from '@/lib/today';
import { formatDate, urgencyOf } from '@/lib/date';
import { ResourceList } from '@/components/uni/ResourceList';
import { AssignmentEditRow } from '@/components/uni/AssignmentEditRow';

export const dynamic = 'force-dynamic';

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ subject: string; assignment: string }>;
}) {
  const user = await requireUser();
  const { subject: subjectId, assignment: assignmentId } = await params;

  const [[subjectRow], [assignmentRow]] = await Promise.all([
    db.select().from(schema.subjects).where(and(eq(schema.subjects.id, subjectId), eq(schema.subjects.user_id, user.id))).limit(1),
    db.select().from(schema.assignments).where(and(eq(schema.assignments.id, assignmentId), eq(schema.assignments.user_id, user.id))).limit(1),
  ]);

  if (!subjectRow || !assignmentRow) notFound();

  const subject = rowToSubject(subjectRow);
  const assignment = rowToAssignment(assignmentRow);
  const tz = user.settings.timezone;
  const urgency = urgencyOf(assignment.due_date, tz);

  const URGENCY_VARIANT: Record<string, 'danger' | 'warning' | 'accent' | 'muted' | 'default'> = {
    overdue: 'danger',
    today: 'warning',
    soon: 'accent',
    later: 'muted',
    none: 'default',
  };

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Link
        href={`/uni/${subjectId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> {subject.name}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge variant="muted">{subject.name}</Badge>
          <Badge variant={URGENCY_VARIANT[urgency]}>
            {urgency === 'none' ? 'sin fecha' : urgency}
          </Badge>
          <Badge variant={assignment.status === 'done' ? 'success' : 'default'}>
            {assignment.status}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold leading-tight">{assignment.title}</h1>
        {assignment.due_date && (
          <p className="text-sm text-muted-foreground mt-1">
            entrega: {formatDate(assignment.due_date, tz)}
          </p>
        )}
      </div>

      {assignment.description && (
        <Card className="mb-4">
          <CardHeader><CardTitle>consigna</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {assignment.description}
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle>recursos</CardTitle></CardHeader>
        <CardContent>
          <ResourceList assignmentId={assignment.id} resources={assignment.resources} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>acciones</CardTitle></CardHeader>
        <CardContent>
          <AssignmentEditRow assignment={{ ...assignment, subjectName: subject.name }} />
        </CardContent>
      </Card>
    </div>
  );
}
