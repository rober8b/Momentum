import { Skeleton } from '@/components/ui/Skeleton';

export default function WorkLoading() {
  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 mx-auto max-w-[1400px]">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-10 w-64 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
