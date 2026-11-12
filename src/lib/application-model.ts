/**
 * Job Application Model for QuickWork.
 *
 * Type definitions for job applications.
 * Application logic is now handled through Supabase.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export enum ApplicationStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  NotSelected = "NotSelected",
  Waitlisted = "Waitlisted",
  WaitlistOffered = "WaitlistOffered", // New: Offer sent, waiting for acceptance
  Expired = "Expired", // New: Waitlist offer expired
}

export type ApplicationStatusValue =
  "Pending" | "Confirmed" | "NotSelected" | "Waitlisted" | "WaitlistOffered" | "Expired";

export interface Application {
  /** Unique application ID */
  id: string;

  /** Worker who applied */
  workerId: string;

  /** Job being applied to */
  jobId: string;

  /** Current application status */
  status: ApplicationStatusValue;

  /** When the application was submitted */
  appliedAt: string; // ISO timestamp

  /** When the application was confirmed by poster (null if not confirmed) */
  confirmedAt: string | null;

  /** When waitlist offer was sent (for WaitlistOffered status) */
  waitlistOfferedAt: string | null;

  /** When waitlist offer expires (for WaitlistOffered status) */
  waitlistOfferExpiresAt: string | null;

  /** Optional note from worker during application */
  workerNote?: string | undefined;

  /** Optional note from poster (e.g., reason for rejection) */
  posterNote?: string | undefined;

  /** Metadata */
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  Pending: "Pending Review",
  Confirmed: "Confirmed",
  NotSelected: "Not Selected",
  Waitlisted: "Waitlisted",
  WaitlistOffered: "Offer Pending",
  Expired: "Offer Expired",
};

export const APPLICATION_STATUS_COLORS: Record<
  ApplicationStatusValue,
  { bg: string; text: string; border: string }
> = {
  Pending: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  Confirmed: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/40",
  },
  NotSelected: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  Waitlisted: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/40",
  },
  WaitlistOffered: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  Expired: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

// ─── Validation Functions ─────────────────────────────────────────────────────

/**
 * Validate application status value.
 */
export function isValidApplicationStatus(value: string): value is ApplicationStatusValue {
  return Object.values(ApplicationStatus).includes(value as ApplicationStatus);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if an application can be confirmed.
 * Only pending or waitlisted applications can be confirmed.
 */
export function canConfirmApplication(status: ApplicationStatusValue): boolean {
  return status === ApplicationStatus.Pending || status === ApplicationStatus.Waitlisted;
}

/**
 * Check if an application can be rejected.
 * Only pending or waitlisted applications can be rejected.
 */
export function canRejectApplication(status: ApplicationStatusValue): boolean {
  return status === ApplicationStatus.Pending || status === ApplicationStatus.Waitlisted;
}

/**
 * Check if an application can be waitlisted.
 * Only pending applications can be moved to waitlist.
 */
export function canWaitlistApplication(status: ApplicationStatusValue): boolean {
  return status === ApplicationStatus.Pending;
}

/**
 * Check if application is in a final state (cannot be changed).
 */
export function isApplicationFinal(status: ApplicationStatusValue): boolean {
  return status === ApplicationStatus.Confirmed || status === ApplicationStatus.NotSelected;
}

