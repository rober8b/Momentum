import { TodayDashboard } from '@/components/today/TodayDashboard';
import { getTodayData } from '@/lib/today';
import { getCurrentUser } from '@/lib/auth';
import { PublicLanding } from '@/components/landing/PublicLanding';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) return <PublicLanding />;
  const data = await getTodayData(user.id, user.settings.timezone);
  return <TodayDashboard data={data} />;
}
