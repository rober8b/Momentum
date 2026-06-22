import Link from 'next/link';
import { Layers } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { rowToPillar } from '@/lib/pillars';
import { PILLAR_TEMPLATES } from '@/lib/pillar-templates';
import { InstantiateTemplateButton } from '@/components/pillars/InstantiateTemplateButton';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

// Sprint B Phase 1 proof page — generic pillar engine, additive, alongside the
// existing /projects. Not linked from the sidebar yet (see
// docs/DYNAMIC_PILLARS.md phase 5+ for when this replaces the hardcoded nav).
export default async function PillarsIndexPage() {
  const user = await requireUser();
  const rows = await db.select().from(schema.pillars).where(eq(schema.pillars.user_id, user.id));
  const pillars = rows.map(rowToPillar);
  const instantiatedKeys = new Set(pillars.map((p) => p.key));
  const availableTemplates = Object.values(PILLAR_TEMPLATES).filter((t) => !instantiatedKeys.has(t.key));

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <div className="mb-6 lg:mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">dynamic pillars — sprint b</p>
        <h2 className="text-2xl lg:text-3xl font-semibold mt-1">pilares</h2>
      </div>

      {pillars.length === 0 ? (
        <EmptyState icon={Layers} title="sin pilares todavía" description="instanciá un template para empezar." />
      ) : (
        <ul className="space-y-2 mb-8">
          {pillars.map((p) => (
            <li key={p.id}>
              <Link
                href={`/p/${p.key}`}
                className="block rounded-md border border-border bg-surface-elev px-4 py-3 hover:border-accent transition-colors"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({p.view_type})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {availableTemplates.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">templates disponibles</p>
          <div className="flex flex-wrap gap-2">
            {availableTemplates.map((t) => (
              <InstantiateTemplateButton key={t.key} template={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
