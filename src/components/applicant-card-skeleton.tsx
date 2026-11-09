/**
 * Applicant Card Skeleton
 *
 * Loading placeholder for applicant cards on hire page.
 * Matches the layout of the actual applicant card component.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function ApplicantCardSkeleton() {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Experience */}
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
      </div>

      {/* Skills */}
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 pt-4 border-t border-border">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </article>
  );
}

export function ApplicantCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ApplicantCardSkeleton key={i} />
      ))}
    </div>
  );
}
