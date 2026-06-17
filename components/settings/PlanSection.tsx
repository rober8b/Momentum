import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UpgradeButton } from '@/components/settings/UpgradeButton';
import { ManageBillingButton } from '@/components/settings/ManageBillingButton';
import { t } from '@/lib/strings';
import type { Lang } from '@/lib/strings';
import type { ResourceUsage } from '@/lib/limits';
import type { UserPlan, UserPlanStatus } from '@/lib/types';

const PLAN_BADGE: Record<UserPlan, 'muted' | 'accent'> = {
  free: 'muted',
  pro: 'accent',
};

const STATUS_BADGE: Record<UserPlanStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  past_due: 'warning',
  cancelled: 'danger',
};

const STATUS_LABEL_KEY: Record<UserPlanStatus, 'planStatusActive' | 'planStatusPastDue' | 'planStatusCancelled'> = {
  active: 'planStatusActive',
  past_due: 'planStatusPastDue',
  cancelled: 'planStatusCancelled',
};

const RESOURCE_LABEL_KEY = {
  assignments: 'resourceAssignments',
  workblocks: 'resourceWorkblocks',
  build_items: 'resourceBuildItems',
  freelance_clients: 'resourceFreelanceClients',
  freelance_tasks: 'resourceFreelanceTasks',
  own_projects: 'resourceOwnProjects',
  organizations: 'resourceOrganizations',
  community_items: 'resourceCommunityItems',
  api_tokens: 'resourceApiTokens',
} as const;

export function PlanSection({
  plan,
  planStatus,
  hosted,
  billingConfigured,
  usage,
  lang,
}: {
  plan: UserPlan;
  planStatus: UserPlanStatus;
  hosted: boolean;
  billingConfigured: boolean;
  usage: ResourceUsage[];
  lang: Lang;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{t('planSection', lang)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('planCurrentPlan', lang)}</span>
            <Badge variant={PLAN_BADGE[plan]}>{t(plan === 'pro' ? 'planPro' : 'planFree', lang)}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('planStatusLabel', lang)}</span>
            <Badge variant={STATUS_BADGE[planStatus]}>{t(STATUS_LABEL_KEY[planStatus], lang)}</Badge>
          </div>
        </div>

        {!hosted ? (
          <p className="text-sm text-muted-foreground">{t('planSelfHosted', lang)}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('planUsage', lang)}</p>
            <div className="space-y-1.5">
              {usage.map(({ resource, current, limit }) => (
                <div key={resource} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{t(RESOURCE_LABEL_KEY[resource], lang)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {limit === null ? `${current} · ${t('planUnlimited', lang)}` : `${current} / ${limit}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hosted && (
          <div className="pt-2 border-t border-border">
            {plan === 'pro' ? (
              billingConfigured && <ManageBillingButton lang={lang} />
            ) : billingConfigured ? (
              <UpgradeButton lang={lang} />
            ) : (
              <p className="text-xs text-muted-foreground">{t('planUpgradeComingSoon', lang)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
