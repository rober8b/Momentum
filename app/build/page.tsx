import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Plus, Lightbulb, FileText, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IdeaCard } from '@/components/build/IdeaCard';
import { DraftCard, PublishedRow } from '@/components/build/DraftCard';
import { db, schema } from '@/lib/db';
import { requireRober } from '@/lib/auth';
import { rowToBuildItem } from '@/lib/today';

export const dynamic = 'force-dynamic';

export default async function BuildPage() {
  await requireRober();

  const rows = await db
    .select()
    .from(schema.buildItems)
    .orderBy(desc(schema.buildItems.created_at));

  const items = rows.map(rowToBuildItem);
  const ideas = items.filter((i) => i.status === 'idea');
  const drafts = items.filter((i) => i.status === 'draft');
  const published = items.filter((i) => i.status === 'published');

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <div className="mb-6 lg:mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            build-in-public
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold mt-1">tracker</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {ideas.length} ideas · {drafts.length} drafts · {published.length} publicados
          </p>
        </div>
        <Link href="/build/new">
          <Button size="md">
            <Plus size={14} />
            nuevo
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <Lightbulb size={14} className="inline mr-1.5 -mt-0.5" />
              ideas ({ideas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {ideas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                capturá una idea desde la Today view, o<br />
                <Link href="/build/new" className="text-accent hover:underline">crear directamente →</Link>
              </p>
            ) : (
              ideas.map((i) => <IdeaCard key={i.id} item={i} />)
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <FileText size={14} className="inline mr-1.5 -mt-0.5" />
              drafts ({drafts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {drafts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                pasá una idea a draft<br />escribiendo hook + cuerpo.
              </p>
            ) : (
              drafts.map((i) => <DraftCard key={i.id} item={i} />)
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <Send size={14} className="inline mr-1.5 -mt-0.5" />
              publicados ({published.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 min-h-[400px]">
            {published.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                sin publicaciones todavía.
              </p>
            ) : (
              published.map((i) => <PublishedRow key={i.id} item={i} />)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground italic">
          @HooCrypto: "share via DM es el signal god-tier de 2026. creá contenido que la gente quiera mandarle a otros."
        </p>
      </div>
    </div>
  );
}
