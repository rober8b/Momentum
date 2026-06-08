import { TodayDashboard } from '@/components/today/TodayDashboard';
import { getTodayData } from '@/lib/today';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getTodayData(user.id, user.settings.timezone);
  return <TodayDashboard data={data} />;
}
