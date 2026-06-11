import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isProviderConfigured } from '@/lib/oauth';
import { getUsageSummary, isHostedMode } from '@/lib/limits';
import { t } from '@/lib/strings';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts';
import { PlanSection } from '@/components/settings/PlanSection';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  const hosted = isHostedMode();
  const [[userRow], accounts, usage] = await Promise.all([
    db.select({ password_hash: schema.users.password_hash }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1),
    db.select({ provider: schema.oauthAccounts.provider }).from(schema.oauthAccounts).where(eq(schema.oauthAccounts.user_id, user.id)),
    hosted ? getUsageSummary(user.id, user.plan) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">perfil</h1>
        <p className="text-sm text-muted-foreground">
          preferencias de cuenta y configuración del dashboard.
        </p>
      </div>
      <ProfileForm user={user} />

      <PlanSection
        plan={user.plan}
        planStatus={user.plan_status}
        hosted={hosted}
        usage={usage}
        lang={user.settings.language}
      />

      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground">{t('accountsTitle', user.settings.language)}</h2>
        <p className="text-xs text-muted-foreground">{t('accountsDescription', user.settings.language)}</p>
      </div>
      <ConnectedAccounts
        connectedProviders={accounts.map((a) => a.provider)}
        hasPassword={!!userRow?.password_hash}
        configuredProviders={{ github: isProviderConfigured('github'), google: isProviderConfigured('google') }}
        lang={user.settings.language}
      />
    </div>
  );
}
