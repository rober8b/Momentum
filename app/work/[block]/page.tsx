import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import { rowToWorkblock } from '@/lib/today';
import { WorkblockEditForm } from '@/components/work/WorkblockEditForm';

export const dynamic = 'force-dynamic';

export default async function WorkblockDetailPage({
  params,
}: {
  params: Promise<{ block: string }>;
}) {
  await requireRober();
  const { block } = await params;

  const rows = await db
    .select()
    .from(schema.workblocks)
    .where(eq(schema.workblocks.id, block))
    .limit(1);

  if (!rows.length) notFound();
  const workblock = rowToWorkblock(rows[0]);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Link
        href="/work"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-6"
      >
        <ArrowLeft size={12} /> kanban
      </Link>
      <WorkblockEditForm workblock={workblock} />
    </div>
  );
}
