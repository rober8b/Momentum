'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { isHostedMode } from '@/lib/limits';
import { getPolarClient, getSiteUrl, isPolarConfigured } from '@/lib/polar';
import { logAudit } from '@/lib/audit';

/**
 * Creates a Polar checkout session for the Pro plan and redirects the current
 * user there. No-ops with an error result if billing isn't configured
 * (self-host, or hosted mode without Polar env vars set).
 */
export async function createCheckoutSession(): Promise<{ error: string } | never> {
  const user = await requireUser();

  if (!isHostedMode() || !isPolarConfigured()) {
    return { error: 'billing_not_configured' };
  }

  const polar = getPolarClient();
  const siteUrl = getSiteUrl();

  const checkout = await polar.checkouts.create({
    products: [process.env.POLAR_PRO_PRODUCT_ID!],
    externalCustomerId: user.id,
    customerEmail: user.email,
    successUrl: `${siteUrl}/settings/profile?checkout=success`,
    metadata: { momentum_user_id: user.id },
  });

  logAudit({ userId: user.id, action: 'billing_checkout_created', metadata: { checkout_id: checkout.id } });

  redirect(checkout.url);
}

/**
 * Creates a Polar customer portal session and redirects the current user there
 * so they can manage or cancel their subscription. No-ops with an error result
 * if billing isn't configured.
 */
export async function openCustomerPortal(): Promise<{ error: string } | never> {
  const user = await requireUser();

  if (!isHostedMode() || !isPolarConfigured()) {
    return { error: 'billing_not_configured' };
  }

  const polar = getPolarClient();
  const siteUrl = getSiteUrl();

  const session = await polar.customerSessions.create({
    externalCustomerId: user.id,
    returnUrl: `${siteUrl}/settings/profile`,
  });

  logAudit({ userId: user.id, action: 'billing_portal_opened' });

  redirect(session.customerPortalUrl);
}
