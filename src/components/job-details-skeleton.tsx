/**
 * Job Details Skeleton
 *
 * Loading placeholder for job details page.
 * Matches the layout of the actual job details view.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function JobDetailsSkeleton() {
  return (
    <div className="min-h-screen pb-24">
      {/* Back button */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-5 py-4 lg:px-8">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-10 w-3/4" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
          </div>
        </header>

        {/* Key Info Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Positions Card */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-full" />
            </div>
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Content Sections */}
        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="mt-8">
            <Skeleton className="h-7 w-48 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </section>
        ))}
      </div>

      {/* Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-12 w-48 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
