import { Skeleton } from '@/components/ui/Skeleton';

export default function CommunityLoading() {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-3xl">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-10 w-48 mb-8" />
      <Skeleton className="h-40 w-full rounded-lg mb-4" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
