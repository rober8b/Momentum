'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PILLAR_TEMPLATES } from '@/lib/pillar-templates';
import { insertPillarItem, LeafItemLimitError } from '@/lib/pillar-writes';
import type { ConfirmedStructure } from './types';

/** Marks the welcome onboarding as seen so it doesn't show again. */
export async function completeOnboarding() {
  const user = await requireUser();

  await db
    .update(schema.users)
    .set({ settings: { ...user.settings, onboarding_completed: true } })
    .where(eq(schema.users.id, user.id));

  revalidatePath('/');
}

/**
 * Creates the pillars + seed items the user confirmed in the preview step,
 * then marks onboarding complete. Idempotent: safe to call twice.
 */
export async function materializeOnboarding(
  structure: ConfirmedStructure,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  // Idempotence: if already completed, nothing to do.
  if (user.settings.onboarding_completed) return { ok: true };

  try {
    for (const [pillarIdx, confirmedPillar] of structure.pillars.entries()) {
      const template = PILLAR_TEMPLATES[confirmedPillar.templateKey];
      if (!template) continue;

      // Find-or-create pillar row (handles partial retries cleanly).
      const [existing] = await db
        .select({ id: schema.pillars.id })
        .from(schema.pillars)
        .where(
          and(
            eq(schema.pillars.user_id, user.id),
            eq(schema.pillars.key, template.key),
          ),
        )
        .limit(1);

      let pillarId: string;
      if (existing) {
        pillarId = existing.id;
      } else {
        const [created] = await db
          .insert(schema.pillars)
          .values({
            user_id: user.id,
            key: template.key,
            name: template.name,
            icon: template.icon,
            description: template.description,
            position: pillarIdx,
            view_type: template.view_type,
            status_workflow: template.status_workflow,
            config: template.config,
            source_template: template.key,
          })
          .returning({ id: schema.pillars.id });
        pillarId = created!.id;
      }

      // Insert items: containers sequential (need ID for children),
      // children parallel within each container.
      let position = 0;
      for (const item of confirmedPillar.items) {
        if (item.is_container) {
          const containerId = await insertPillarItem({
            userId: user.id,
            pillarId,
            isContainer: true,
            title: item.title,
            status: item.status,
            position: position++,
            fields: item.fields,
            isSample: false,
          });

          await Promise.all(
            item.children.map((child, childIdx) =>
              insertPillarItem({
                userId: user.id,
                pillarId,
                parentItemId: containerId,
                isContainer: false,
                title: child.title,
                status: child.status,
                position: childIdx,
                fields: child.fields,
                isSample: false,
              }),
            ),
          );
        } else {
          await insertPillarItem({
            userId: user.id,
            pillarId,
            isContainer: false,
            title: item.title,
            status: item.status,
            position: position++,
            fields: item.fields,
            isSample: false,
          });
        }
      }
    }

    // Mark onboarding complete + revalidate.
    await db
      .update(schema.users)
      .set({ settings: { ...user.settings, onboarding_completed: true } })
      .where(eq(schema.users.id, user.id));

    revalidatePath('/');
    revalidatePath('/p');
    for (const pillar of structure.pillars) {
      revalidatePath(`/p/${pillar.templateKey}`);
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof LeafItemLimitError) {
      return { ok: false, error: 'plan_limit' };
    }
    console.error('[materializeOnboarding]', err);
    return { ok: false, error: 'unknown' };
  }
}
