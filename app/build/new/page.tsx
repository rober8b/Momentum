import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BuildEditor } from '@/components/build/BuildEditor';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToBuildItem } from '@/lib/today';
import type { BuildItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ edit?: string; from?: string }>;

export default async function BuildNewPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { edit, from } = await searchParams;

  let existing: BuildItem | null = null;
  if (edit || from) {
    const id = (edit ?? from)!;
    const rows = await db
      .select()
      .from(schema.buildItems)
      .where(eq(schema.buildItems.id, id))
      .limit(1);
    if (rows.length) existing = rowToBuildItem(rows[0]);
    else if (edit) notFound();
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Link
        href="/build"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> tracker
      </Link>

      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          {edit ? 'editar' : 'nuevo'}
        </p>
        <h2 className="text-2xl lg:text-3xl font-semibold mt-1">
          {edit ? 'editar draft' : 'nuevo post'}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>compose</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildEditor
            mode={edit ? 'edit' : 'create'}
            sourceId={edit ?? from ?? null}
            existing={existing}
          />
        </CardContent>
      </Card>
    </div>
  );
}
