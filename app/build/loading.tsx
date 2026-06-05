import { Skeleton } from '@/components/ui/Skeleton';

export default function BuildLoading() {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <Skeleton className="h-4 w-40 mb-2" />
      <Skeleton className="h-10 w-48 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-3 min-h-[400px]">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
