import type { validateEvent } from '@polar-sh/sdk/webhooks';
import type { AuditAction } from '@/lib/audit';
import type { UserPlan, UserPlanStatus } from '@/lib/types';

export type PolarWebhookEvent = ReturnType<typeof validateEvent>;

export type PolarPlanResolution = {
  plan: UserPlan;
  planStatus: UserPlanStatus;
  auditAction: AuditAction;
  externalId: string | null | undefined;
  polarCustomerId: string;
  polarSubscriptionId: string | null;
};

/**
 * Maps a verified Polar webhook event to the plan/plan_status the user should
 * be set to. Pure — no DB access, no side effects — so the money logic (which
 * event flips a user to 'pro' vs 'free') is testable without mocking Polar's
 * SDK or the database.
 *
 * Returns null for event types that don't change plan state (transient
 * subscription.updated statuses, or any event type we don't act on) — callers
 * should ack with 200 and do nothing.
 */
export function resolvePolarEvent(event: PolarWebhookEvent): PolarPlanResolution | null {
  switch (event.type) {
    // ── Active / new subscription ─────────────────────────────────────────────
    case 'subscription.created':
    case 'subscription.active': {
      return {
        plan: 'pro',
        planStatus: 'active',
        auditAction: 'billing_subscription_activated',
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.id,
      };
    }

    // ── Status change — derive new plan state from data.status ────────────────
    case 'subscription.updated': {
      const status = event.data.status;
      let plan: UserPlan;
      let planStatus: UserPlanStatus;
      let auditAction: AuditAction;
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
        return null;
      }
      return {
        plan,
        planStatus,
        auditAction,
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.id,
      };
    }

    // ── Cancel requested (cancel_at_period_end=true — access continues) ───────
    case 'subscription.canceled': {
      return {
        plan: 'pro',
        planStatus: 'cancelled',
        auditAction: 'billing_subscription_canceled',
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.id,
      };
    }

    // ── Payment failed, retrying ──────────────────────────────────────────────
    case 'subscription.past_due': {
      return {
        plan: 'pro',
        planStatus: 'past_due',
        auditAction: 'billing_subscription_past_due',
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.id,
      };
    }

    // ── Only downgrade-to-free event (period ended / retries exhausted) ───────
    case 'subscription.revoked': {
      return {
        plan: 'free',
        planStatus: 'active',
        auditAction: 'billing_subscription_revoked',
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.id,
      };
    }

    // ── Fallback activation signal: order fully paid ──────────────────────────
    // Handles recurring-sub first-payment confirmation and any checkout flow
    // that emits order.paid before subscription.active. Upgrade only — never
    // downgrades (cancellation/revocation must come from subscription.* events).
    case 'order.paid': {
      return {
        plan: 'pro',
        planStatus: 'active',
        auditAction: 'billing_subscription_activated',
        externalId: event.data.customer.externalId,
        polarCustomerId: event.data.customerId,
        polarSubscriptionId: event.data.subscriptionId,
      };
    }

    default:
      return null;
  }
}
