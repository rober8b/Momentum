import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { logAudit } from '@/lib/audit';
import { resolvePolarEvent } from '@/lib/polar-webhook';

export const runtime = 'nodejs';

// Polar (Merchant of Record) webhooks — source of truth for plan/plan_status.
// Public route (see proxy.ts PUBLIC_PATHS), protected by signature verification.
export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 404 });
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = validateEvent(body, headers, secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.error('[polar webhook] signature verification failed:', (err as Error).message);
      return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
    }
    console.error('[polar webhook] validateEvent threw unexpected error:', err);
    throw err;
  }

  const resolution = resolvePolarEvent(event);
  if (!resolution) {
    return NextResponse.json({ received: true });
  }
  const { plan, planStatus, auditAction, externalId, polarCustomerId, polarSubscriptionId } = resolution;

  if (!externalId) {
    console.error(`[polar webhook] ${event.type}: no external_id on customer — cannot resolve user`);
    return NextResponse.json({ received: true });
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, externalId)).limit(1);

  if (!user) {
    console.error(`[polar webhook] ${event.type}: no user for external_id ${externalId}`);
    return NextResponse.json({ received: true });
  }

  await db
    .update(schema.users)
    .set({
      plan,
      plan_status: planStatus,
      polar_customer_id: polarCustomerId,
      ...(polarSubscriptionId !== null && { polar_subscription_id: polarSubscriptionId }),
    })
    .where(eq(schema.users.id, user.id));

  logAudit({
    userId: user.id,
    action: auditAction,
    entityType: 'subscription',
    entityId: polarSubscriptionId ?? undefined,
    metadata: { event_type: event.type, polar_customer_id: polarCustomerId },
  });

  revalidatePath('/');
  revalidatePath('/settings/profile');

  return NextResponse.json({ received: true });
}
