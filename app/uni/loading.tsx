import { Skeleton } from '@/components/ui/Skeleton';

export default function UniLoading() {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-10 w-48 mb-6" />
      <Skeleton className="h-64 w-full rounded-lg mb-6" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
