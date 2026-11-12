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
}9", jobId: "2", workerNote: "Experienced kitchen helper." },
    { workerId: "worker_10", jobId: "2", workerNote: "3 years catering experience." },
    { workerId: "worker_11", jobId: "2" },
    { workerId: "worker_12", jobId: "2", workerNote: "Quick learner, hard worker." },

    // Job 3: Dishwashing crew (3 positions, 0 confirmed - open)
    { workerId: "worker_13", jobId: "3", workerNote: "Available for recurring shifts." },
    { workerId: "worker_14", jobId: "3" },
    { workerId: "worker_15", jobId: "3", workerNote: "Live nearby, can start immediately." },
  ];

  // Submit all applications
  const createdApps = sampleApplications
    .map((app) => submitApplication(app))
    .filter((result) => result.success && result.application)
    .map((result) => result.application!);

  // Job 1: Confirm 6, leave 2 pending
  if (createdApps[0]) confirmApplication(createdApps[0].id, "Great experience!");
  if (createdApps[1]) confirmApplication(createdApps[1].id, "Welcome aboard!");
  if (createdApps[2]) confirmApplication(createdApps[2].id, "Perfect for this event!");
  if (createdApps[3]) confirmApplication(createdApps[3].id);
  if (createdApps[4]) confirmApplication(createdApps[4].id);
  if (createdApps[5]) confirmApplication(createdApps[5].id);
  // createdApps[6] and [7] remain Pending

  // Job 2: Confirm all 4 (fully filled)
  if (createdApps[8]) confirmApplication(createdApps[8].id, "Confirmed!");
  if (createdApps[9]) confirmApplication(createdApps[9].id, "Confirmed!");
  if (createdApps[10]) confirmApplication(createdApps[10].id);
  if (createdApps[11]) confirmApplication(createdApps[11].id);

  // Job 3: Leave all pending (open job)
  // All 3 applications remain in Pending state
}
