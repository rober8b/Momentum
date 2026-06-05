import { Skeleton } from '@/components/ui/Skeleton';

export default function ProjectsLoading() {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-7xl">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-10 w-48 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
