import { describe, it, expect } from 'vitest';
import { resolvePolarEvent, type PolarWebhookEvent } from '@/lib/polar-webhook';

// Minimal mock payloads — only the fields resolvePolarEvent actually reads.
// Real Polar payloads carry far more fields; we don't need them to test the
// event -> plan/plan_status mapping, which is the money logic.
function mockEvent(type: string, data: Record<string, unknown>): PolarWebhookEvent {
  return { type, data } as unknown as PolarWebhookEvent;
}

const CUSTOMER = { externalId: 'user-123' };

describe('resolvePolarEvent', () => {
  it('subscription.created -> pro/active', () => {
    const event = mockEvent('subscription.created', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toEqual({
      plan: 'pro',
      planStatus: 'active',
      auditAction: 'billing_subscription_activated',
      externalId: 'user-123',
      polarCustomerId: 'cus_1',
      polarSubscriptionId: 'sub_1',
    });
  });

  it('subscription.active -> pro/active', () => {
    const event = mockEvent('subscription.active', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'active' });
  });

  describe('subscription.updated — status-derived transitions', () => {
    it('status=active -> pro/active', () => {
      const event = mockEvent('subscription.updated', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER, status: 'active' });
      expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'active', auditAction: 'billing_subscription_activated' });
    });

    it('status=trialing -> pro/active', () => {
      const event = mockEvent('subscription.updated', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER, status: 'trialing' });
      expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'active' });
    });

    it('status=past_due -> pro/past_due', () => {
      const event = mockEvent('subscription.updated', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER, status: 'past_due' });
      expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'past_due', auditAction: 'billing_subscription_past_due' });
    });

    it('status=canceled -> pro/cancelled', () => {
      const event = mockEvent('subscription.updated', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER, status: 'canceled' });
      expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'cancelled', auditAction: 'billing_subscription_canceled' });
    });

    it.each(['incomplete', 'incomplete_expired', 'unpaid'])('status=%s is transient — no plan change', (status) => {
      const event = mockEvent('subscription.updated', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER, status });
      expect(resolvePolarEvent(event)).toBeNull();
    });
  });

  it('subscription.canceled -> pro/cancelled (access continues until period end)', () => {
    const event = mockEvent('subscription.canceled', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'cancelled', auditAction: 'billing_subscription_canceled' });
  });

  it('subscription.past_due -> pro/past_due', () => {
    const event = mockEvent('subscription.past_due', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toMatchObject({ plan: 'pro', planStatus: 'past_due', auditAction: 'billing_subscription_past_due' });
  });

  it('subscription.revoked -> free/active (the only downgrade event)', () => {
    const event = mockEvent('subscription.revoked', { id: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toEqual({
      plan: 'free',
      planStatus: 'active',
      auditAction: 'billing_subscription_revoked',
      externalId: 'user-123',
      polarCustomerId: 'cus_1',
      polarSubscriptionId: 'sub_1',
    });
  });

  it('order.paid -> pro/active, using subscriptionId (not id)', () => {
    const event = mockEvent('order.paid', { subscriptionId: 'sub_99', customerId: 'cus_1', customer: CUSTOMER });
    expect(resolvePolarEvent(event)).toMatchObject({
      plan: 'pro',
      planStatus: 'active',
      auditAction: 'billing_subscription_activated',
      polarSubscriptionId: 'sub_99',
    });
  });

  it('unhandled event types resolve to null (ack, no-op)', () => {
    const event = mockEvent('checkout.created', { id: 'chk_1' });
    expect(resolvePolarEvent(event)).toBeNull();
  });

  it('never downgrades on order.paid — only subscription.revoked downgrades to free', () => {
    const allEventsExceptRevoked = [
      'subscription.created',
      'subscription.active',
      'subscription.canceled',
      'subscription.past_due',
      'order.paid',
    ];
    for (const type of allEventsExceptRevoked) {
      const event = mockEvent(type, { id: 'sub_1', subscriptionId: 'sub_1', customerId: 'cus_1', customer: CUSTOMER });
      const resolution = resolvePolarEvent(event);
      expect(resolution?.plan).not.toBe('free');
    }
  });
});
