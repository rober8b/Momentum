import { TodayDashboard } from '@/components/today/TodayDashboard';
import { getTodayData } from '@/lib/today';
import { requireRober } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  await requireRober();
  const data = await getTodayData();
  return <TodayDashboard data={data} />;
}
