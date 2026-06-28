import { TodayDashboard } from '@/components/today/TodayDashboard';
import { getTodayData } from '@/lib/today';
import { getCurrentUser } from '@/lib/auth';
import { PublicLanding } from '@/components/landing/PublicLanding';
import { OnboardingFlow } from '@/app/onboarding/OnboardingFlow';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) return <PublicLanding />;
  if (!user.settings.onboarding_completed) {
    return <OnboardingFlow lang={user.settings.language} />;
  }
  const data = await getTodayData(user.id, user.settings.timezone);
  return <TodayDashboard data={data} lang={user.settings.language} />;
}
