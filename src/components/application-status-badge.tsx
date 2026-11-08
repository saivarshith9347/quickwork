/**
 * Application Status Badge Component
 * Displays application status with appropriate colors and labels
 * Supports both legacy Zustand and Supabase ApplicationStatus values.
 */

import type { ApplicationStatus as ServiceApplicationStatus } from '@/lib/services/application-service';
import type { ApplicationStatusValue as ModelStatusValue } from '@/lib/application-model';

interface ApplicationStatusBadgeProps {
  status: ModelStatusValue | ServiceApplicationStatus | string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Pending: { label: "Pending", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  PENDING: { label: "Pending", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  Confirmed: { label: "Confirmed", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  CONFIRMED: { label: "Confirmed", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  BOOKED: { label: "Booked", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  ACCEPTED: { label: "Accepted", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  NotSelected: { label: "Not Selected", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  REJECTED: { label: "Not Selected", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  Waitlisted: { label: "Waitlisted", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  WaitlistOffered: { label: "Spot Offered", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  CANCELLED: { label: "Cancelled", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  Cancelled: { label: "Cancelled", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  Expired: { label: "Expired", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  EXPIRED: { label: "Expired", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

export function ApplicationStatusBadge({ status, className = '' }: ApplicationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };
  
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {config.label}
    </span>
  );
}
