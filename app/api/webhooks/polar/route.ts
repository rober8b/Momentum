import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { logAudit, type AuditAction } from '@/lib/audit';
import type { UserPlan, UserPlanStatus } from '@/lib/types';

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

  // Fields resolved per event shape; set inside the switch.
  let plan: UserPlan;
  let planStatus: UserPlanStatus;
  let auditAction: AuditAction;
  let externalId: string | null | undefined;
  let polarCustomerId: string;
  let polarSubscriptionId: string | null = null;

  switch (event.type) {
    // ── Active / new subscription ─────────────────────────────────────────────
    case 'subscription.created':
    case 'subscription.active': {
      plan = 'pro';
      planStatus = 'active';
      auditAction = 'billing_subscription_activated';
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.id;
      break;
    }

    // ── Status change — derive new plan state from data.status ────────────────
    case 'subscription.updated': {
      const status = event.data.status;
      if (status === 'active' || status === 'trialing') {
        plan = 'pro';
        planStatus = 'active';
        auditAction = 'billing_subscription_activated';
      } else if (status === 'past_due') {
        plan = 'pro';
        planStatus = 'past_due';
        auditAction = 'billing_subscription_past_due';
      } else if (status === 'canceled') {
        plan = 'pro';
        planStatus = 'cancelled';
        auditAction = 'billing_subscription_canceled';
      } else {
        // incomplete / incomplete_expired / unpaid — transient; don't change plan.
        return NextResponse.json({ received: true });
      }
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.id;
      break;
    }

    // ── Cancel requested (cancel_at_period_end=true — access continues) ───────
    case 'subscription.canceled': {
      plan = 'pro';
      planStatus = 'cancelled';
      auditAction = 'billing_subscription_canceled';
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.id;
      break;
    }

    // ── Payment failed, retrying ──────────────────────────────────────────────
    case 'subscription.past_due': {
      plan = 'pro';
      planStatus = 'past_due';
      auditAction = 'billing_subscription_past_due';
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.id;
      break;
    }

    // ── Only downgrade-to-free event (period ended / retries exhausted) ───────
    case 'subscription.revoked': {
      plan = 'free';
      planStatus = 'active';
      auditAction = 'billing_subscription_revoked';
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.id;
      break;
    }

    // ── Fallback activation signal: order fully paid ──────────────────────────
    // Handles recurring-sub first-payment confirmation and any checkout flow
    // that emits order.paid before subscription.active. Upgrade only — never
    // downgrades (cancellation/revocation must come from subscription.* events).
    case 'order.paid': {
      plan = 'pro';
      planStatus = 'active';
      auditAction = 'billing_subscription_activated';
      externalId = event.data.customer.externalId;
      polarCustomerId = event.data.customerId;
      polarSubscriptionId = event.data.subscriptionId;
      break;
    }

    default:
      return NextResponse.json({ received: true });
  }

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
