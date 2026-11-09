/**
 * Skeleton Component
 *
 * Animated loading placeholders that match our design system.
 * Used for loading states across the application.
 */

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

export { Skeleton };
