/**
 * Job Application Model for QuickWork.
 *
 * Separate from bookings - applications are requests to work on a job.
 * The poster must explicitly confirm applications before workers are assigned.
 *
 * Flow:
 * 1. Worker applies to a job → status: Pending
 * 2. Poster reviews and either:
 *    - Confirms → status: Confirmed (worker is assigned)
 *    - Rejects → status: NotSelected
 *    - Waitlists → status: Waitlisted (backup if confirmed workers drop out)
 * 3. Duplicate applications from the same worker to the same job are prevented
 */

import { create } from "zustand";

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

// ─── Application Store (State + Actions) ──────────────────────────────────────

interface ApplicationStore {
  // Data
  applications: Record<string, Application>;

  // Indexes for quick lookups
  applicationsByWorker: Record<string, string[]>; // workerId -> applicationIds[]
  applicationsByJob: Record<string, string[]>; // jobId -> applicationIds[]

  // Actions

  /**
   * Submit a new application.
   * Prevents duplicate applications from the same worker to the same job.
   */
  submitApplication: (params: { workerId: string; jobId: string; workerNote?: string }) => {
    success: boolean;
    application: Application | null;
    reason?: "duplicate_application" | "invalid_params";
    message?: string;
  };

  /**
   * Confirm an application (poster action).
   * Sets status to Confirmed and records confirmedAt timestamp.
   * Validates that confirming won't exceed position limits.
   */
  confirmApplication: (
    applicationId: string,
    posterNote?: string,
    jobPositionsTotal?: number,
  ) => {
    success: boolean;
    application: Application | null;
    reason?: "not_found" | "invalid_status" | "already_confirmed" | "positions_full";
    message?: string;
  };

  /**
   * Reject an application (poster action).
   * Sets status to NotSelected.
   */
  rejectApplication: (
    applicationId: string,
    posterNote?: string,
  ) => {
    success: boolean;
    application: Application | null;
    reason?: "not_found" | "invalid_status";
  };

  /**
   * Move application to waitlist (poster action).
   * Sets status to Waitlisted.
   */
  waitlistApplication: (
    applicationId: string,
    posterNote?: string,
  ) => {
    success: boolean;
    application: Application | null;
    reason?: "not_found" | "invalid_status";
  };

  /**
   * Get all applications for a specific job.
   * Optionally filter by status.
   */
  getApplicationsForJob: (jobId: string, statusFilter?: ApplicationStatusValue) => Application[];

  /**
   * Get all applications by a specific worker.
   * Optionally filter by status.
   */
  getApplicationsByWorker: (
    workerId: string,
    statusFilter?: ApplicationStatusValue,
  ) => Application[];

  /**
   * Get a single application by ID.
   */
  getApplication: (applicationId: string) => Application | null;

  /**
   * Check if a worker has already applied to a job.
   */
  hasApplied: (workerId: string, jobId: string) => boolean;

  /**
   * Get statistics for a job's applications.
   */
  getJobApplicationStats: (jobId: string) => {
    total: number;
    pending: number;
    confirmed: number;
    notSelected: number;
    waitlisted: number;
  };

  /**
   * Get confirmed applications count for a job.
   * This is what updates positionsConfirmed in the Job model.
   */
  getConfirmedCount: (jobId: string) => number;

  /**
   * Cancel a confirmed application (worker cancels).
   * Triggers automatic waitlist promotion if available.
   */
  cancelConfirmedApplication: (
    applicationId: string,
    reason?: string,
  ) => {
    success: boolean;
    application: Application | null;
    promotedFromWaitlist?: Application | null;
    reason?: string;
    message?: string;
  };

  /**
   * Offer position to next person on waitlist.
   * Sets expiry time for the offer.
   */
  offerPositionFromWaitlist: (
    jobId: string,
    offerDurationMinutes?: number,
  ) => {
    success: boolean;
    application: Application | null;
    message?: string;
  };

  /**
   * Accept a waitlist offer (worker accepts).
   */
  acceptWaitlistOffer: (applicationId: string) => {
    success: boolean;
    application: Application | null;
    reason?: string;
    message?: string;
  };

  /**
   * Reject a waitlist offer (worker declines).
   * Automatically offers to next person on waitlist.
   */
  rejectWaitlistOffer: (applicationId: string) => {
    success: boolean;
    nextOffered?: Application | null;
    message?: string;
  };

  /**
   * Expire a waitlist offer (time ran out).
   * Automatically offers to next person on waitlist.
   */
  expireWaitlistOffer: (applicationId: string) => {
    success: boolean;
    nextOffered?: Application | null;
  };

  /**
   * Get next eligible person on waitlist for a job.
   */
  getNextWaitlistedApplicant: (jobId: string) => Application | null;

  // Internal
  _generateId: () => string;
  _updateIndexes: (application: Application) => void;
}

export const useApplicationStore = create<ApplicationStore>()((set, get) => ({
  applications: {},
  applicationsByWorker: {},
  applicationsByJob: {},

  // ─── Submit Application ───────────────────────────────────────────────────
  submitApplication: (params) => {
    const { workerId, jobId, workerNote } = params;

    // Validate params
    if (!workerId || !jobId) {
      return {
        success: false,
        application: null,
        reason: "invalid_params" as const,
        message: "Worker ID and Job ID are required.",
      };
    }

    // Check for duplicate application
    if (get().hasApplied(workerId, jobId)) {
      return {
        success: false,
        application: null,
        reason: "duplicate_application" as const,
        message: "You have already applied to this job.",
      };
    }

    // Create new application
    const now = new Date().toISOString();
    const applicationId = get()._generateId();

    const application: Application = {
      id: applicationId,
      workerId,
      jobId,
      status: ApplicationStatus.Pending,
      appliedAt: now,
      confirmedAt: null,
      waitlistOfferedAt: null,
      waitlistOfferExpiresAt: null,
      workerNote,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: application,
      },
    }));

    // Update indexes
    get()._updateIndexes(application);

    return {
      success: true,
      application,
    };
  },

  // ─── Confirm Application ──────────────────────────────────────────────────
  confirmApplication: (applicationId, posterNote, jobPositionsTotal) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application) {
      return {
        success: false,
        application: null,
        reason: "not_found" as const,
        message: "Application not found.",
      };
    }

    // Check if already confirmed
    if (application.status === ApplicationStatus.Confirmed) {
      return {
        success: false,
        application: null,
        reason: "already_confirmed" as const,
        message: "This application has already been confirmed.",
      };
    }

    // Check if status allows confirmation
    if (!canConfirmApplication(application.status)) {
      return {
        success: false,
        application: null,
        reason: "invalid_status" as const,
        message: `Cannot confirm application with status "${application.status}".`,
      };
    }

    // Validate position limits
    if (jobPositionsTotal !== undefined) {
      const currentConfirmed = get().getConfirmedCount(application.jobId);
      if (currentConfirmed >= jobPositionsTotal) {
        return {
          success: false,
          application: null,
          reason: "positions_full" as const,
          message: `All ${jobPositionsTotal} positions are already filled. Add to waitlist instead.`,
        };
      }
    }

    // Update application
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.Confirmed,
      confirmedAt: now,
      posterNote,
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    return {
      success: true,
      application: updatedApplication,
    };
  },

  // ─── Reject Application ───────────────────────────────────────────────────
  rejectApplication: (applicationId, posterNote) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application) {
      return {
        success: false,
        application: null,
        reason: "not_found" as const,
      };
    }

    // Check if status allows rejection
    if (!canRejectApplication(application.status)) {
      return {
        success: false,
        application: null,
        reason: "invalid_status" as const,
      };
    }

    // Update application
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.NotSelected,
      posterNote,
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    return {
      success: true,
      application: updatedApplication,
    };
  },

  // ─── Waitlist Application ─────────────────────────────────────────────────
  waitlistApplication: (applicationId, posterNote) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application) {
      return {
        success: false,
        application: null,
        reason: "not_found" as const,
      };
    }

    // Check if status allows waitlisting
    if (!canWaitlistApplication(application.status)) {
      return {
        success: false,
        application: null,
        reason: "invalid_status" as const,
      };
    }

    // Update application
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.Waitlisted,
      posterNote,
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    return {
      success: true,
      application: updatedApplication,
    };
  },

  // ─── Get Applications for Job ─────────────────────────────────────────────
  getApplicationsForJob: (jobId, statusFilter) => {
    const { applications, applicationsByJob } = get();
    const applicationIds = applicationsByJob[jobId] || [];

    let jobApplications = applicationIds
      .map((id) => applications[id])
      .filter((app): app is Application => app !== undefined);

    if (statusFilter) {
      jobApplications = jobApplications.filter((app) => app.status === statusFilter);
    }

    // Sort by appliedAt (most recent first)
    return jobApplications.sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    );
  },

  // ─── Get Applications by Worker ───────────────────────────────────────────
  getApplicationsByWorker: (workerId, statusFilter) => {
    const { applications, applicationsByWorker } = get();
    const applicationIds = applicationsByWorker[workerId] || [];

    let workerApplications = applicationIds
      .map((id) => applications[id])
      .filter((app): app is Application => app !== undefined);

    if (statusFilter) {
      workerApplications = workerApplications.filter((app) => app.status === statusFilter);
    }

    // Sort by appliedAt (most recent first)
    return workerApplications.sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    );
  },

  // ─── Get Single Application ───────────────────────────────────────────────
  getApplication: (applicationId) => {
    return get().applications[applicationId] || null;
  },

  // ─── Check if Worker Has Applied ──────────────────────────────────────────
  hasApplied: (workerId, jobId) => {
    const { applications, applicationsByWorker } = get();
    const workerApplicationIds = applicationsByWorker[workerId] || [];

    return workerApplicationIds.some((appId) => {
      const app = applications[appId];
      return app && app.jobId === jobId;
    });
  },

  // ─── Get Job Application Statistics ───────────────────────────────────────
  getJobApplicationStats: (jobId) => {
    const applications = get().getApplicationsForJob(jobId);

    const stats = {
      total: applications.length,
      pending: 0,
      confirmed: 0,
      notSelected: 0,
      waitlisted: 0,
    };

    applications.forEach((app) => {
      switch (app.status) {
        case ApplicationStatus.Pending:
          stats.pending++;
          break;
        case ApplicationStatus.Confirmed:
          stats.confirmed++;
          break;
        case ApplicationStatus.NotSelected:
          stats.notSelected++;
          break;
        case ApplicationStatus.Waitlisted:
          stats.waitlisted++;
          break;
      }
    });

    return stats;
  },

  // ─── Get Confirmed Count ──────────────────────────────────────────────────
  getConfirmedCount: (jobId) => {
    const applications = get().getApplicationsForJob(jobId, ApplicationStatus.Confirmed);
    return applications.length;
  },

  // ─── Cancel Confirmed Application ─────────────────────────────────────────
  cancelConfirmedApplication: (applicationId, reason) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application) {
      return {
        success: false,
        application: null,
        reason: "not_found",
        message: "Application not found.",
      };
    }

    if (application.status !== ApplicationStatus.Confirmed) {
      return {
        success: false,
        application: null,
        reason: "not_confirmed",
        message: "Only confirmed applications can be cancelled.",
      };
    }

    // Cancel the application
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.NotSelected,
      posterNote: reason || "Worker cancelled their confirmed position.",
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    // Automatically offer to next person on waitlist
    const nextResult = get().offerPositionFromWaitlist(application.jobId);

    return {
      success: true,
      application: updatedApplication,
      promotedFromWaitlist: nextResult.application,
      message: nextResult.application
        ? `Position offered to ${nextResult.application.workerId} from waitlist.`
        : "No one on waitlist to promote.",
    };
  },

  // ─── Offer Position from Waitlist ─────────────────────────────────────────
  offerPositionFromWaitlist: (jobId, offerDurationMinutes = 60) => {
    const nextApplicant = get().getNextWaitlistedApplicant(jobId);

    if (!nextApplicant) {
      return {
        success: false,
        application: null,
        message: "No eligible applicants on waitlist.",
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + offerDurationMinutes * 60 * 1000);

    const updatedApplication: Application = {
      ...nextApplicant,
      status: ApplicationStatus.WaitlistOffered,
      waitlistOfferedAt: now.toISOString(),
      waitlistOfferExpiresAt: expiresAt.toISOString(),
      posterNote: "Position opened up - offer sent from waitlist",
      updatedAt: now.toISOString(),
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [nextApplicant.id]: updatedApplication,
      },
    }));

    // In real app, schedule expiry check and send notification
    console.log(`📧 Waitlist offer sent to ${nextApplicant.workerId} for job ${jobId}`);
    console.log(`⏰ Offer expires at ${expiresAt.toLocaleString()}`);

    return {
      success: true,
      application: updatedApplication,
      message: `Position offered to applicant from waitlist. Expires in ${offerDurationMinutes} minutes.`,
    };
  },

  // ─── Accept Waitlist Offer ────────────────────────────────────────────────
  acceptWaitlistOffer: (applicationId) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application) {
      return {
        success: false,
        application: null,
        reason: "not_found",
        message: "Application not found.",
      };
    }

    if (application.status !== ApplicationStatus.WaitlistOffered) {
      return {
        success: false,
        application: null,
        reason: "not_offered",
        message: "No active waitlist offer for this application.",
      };
    }

    // Check if offer has expired
    if (application.waitlistOfferExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(application.waitlistOfferExpiresAt);
      if (now > expiresAt) {
        return {
          success: false,
          application: null,
          reason: "expired",
          message: "This offer has expired.",
        };
      }
    }

    // Accept the offer - promote to Confirmed
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.Confirmed,
      confirmedAt: now,
      posterNote: "Accepted from waitlist offer",
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    console.log(`✅ ${application.workerId} accepted waitlist offer for job ${application.jobId}`);

    return {
      success: true,
      application: updatedApplication,
      message: "Congratulations! You have been confirmed for this job.",
    };
  },

  // ─── Reject Waitlist Offer ────────────────────────────────────────────────
  rejectWaitlistOffer: (applicationId) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application || application.status !== ApplicationStatus.WaitlistOffered) {
      return {
        success: false,
        message: "No active waitlist offer found.",
      };
    }

    // Mark as declined
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.NotSelected,
      posterNote: "Declined waitlist offer",
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    // Offer to next person on waitlist
    const nextResult = get().offerPositionFromWaitlist(application.jobId);

    console.log(`❌ ${application.workerId} declined waitlist offer for job ${application.jobId}`);

    return {
      success: true,
      nextOffered: nextResult.application,
      message: nextResult.application
        ? "Offer sent to next person on waitlist."
        : "No more applicants on waitlist.",
    };
  },

  // ─── Expire Waitlist Offer ────────────────────────────────────────────────
  expireWaitlistOffer: (applicationId) => {
    const { applications } = get();
    const application = applications[applicationId];

    if (!application || application.status !== ApplicationStatus.WaitlistOffered) {
      return {
        success: false,
      };
    }

    // Mark as expired
    const now = new Date().toISOString();
    const updatedApplication: Application = {
      ...application,
      status: ApplicationStatus.Expired,
      posterNote: "Waitlist offer expired - no response",
      updatedAt: now,
    };

    set((state) => ({
      applications: {
        ...state.applications,
        [applicationId]: updatedApplication,
      },
    }));

    // Offer to next person on waitlist
    const nextResult = get().offerPositionFromWaitlist(application.jobId);

    console.log(
      `⏰ Waitlist offer expired for ${application.workerId} on job ${application.jobId}`,
    );

    return {
      success: true,
      nextOffered: nextResult.application,
    };
  },

  // ─── Get Next Waitlisted Applicant ────────────────────────────────────────
  getNextWaitlistedApplicant: (jobId: string): Application | null => {
    const waitlistedApps = get().getApplicationsForJob(jobId, ApplicationStatus.Waitlisted);

    // Return the oldest waitlisted application (first in queue)
    return waitlistedApps.length > 0 ? waitlistedApps[waitlistedApps.length - 1]! : null;
  },

  // ─── Internal: Generate ID ────────────────────────────────────────────────
  _generateId: () => {
    return `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },

  // ─── Internal: Update Indexes ─────────────────────────────────────────────
  _updateIndexes: (application) => {
    set((state) => {
      // Update worker index
      const workerApps = state.applicationsByWorker[application.workerId] || [];
      const updatedWorkerApps = workerApps.includes(application.id)
        ? workerApps
        : [...workerApps, application.id];

      // Update job index
      const jobApps = state.applicationsByJob[application.jobId] || [];
      const updatedJobApps = jobApps.includes(application.id)
        ? jobApps
        : [...jobApps, application.id];

      return {
        applicationsByWorker: {
          ...state.applicationsByWorker,
          [application.workerId]: updatedWorkerApps,
        },
        applicationsByJob: {
          ...state.applicationsByJob,
          [application.jobId]: updatedJobApps,
        },
      };
    });
  },
}));

// ─── Application Hook ─────────────────────────────────────────────────────────

/**
 * Hook for managing applications with common operations.
 */
export function useApplications() {
  const {
    submitApplication,
    confirmApplication,
    rejectApplication,
    waitlistApplication,
    cancelConfirmedApplication,
    offerPositionFromWaitlist,
    acceptWaitlistOffer,
    rejectWaitlistOffer,
    expireWaitlistOffer,
    getApplicationsForJob,
    getApplicationsByWorker,
    getApplication,
    hasApplied,
    getJobApplicationStats,
    getConfirmedCount,
    getNextWaitlistedApplicant,
  } = useApplicationStore();

  return {
    // Actions
    submitApplication,
    confirmApplication,
    rejectApplication,
    waitlistApplication,
    cancelConfirmedApplication,
    offerPositionFromWaitlist,
    acceptWaitlistOffer,
    rejectWaitlistOffer,
    expireWaitlistOffer,

    // Queries
    getApplicationsForJob,
    getApplicationsByWorker,
    getApplication,
    hasApplied,
    getJobApplicationStats,
    getConfirmedCount,
    getNextWaitlistedApplicant,
  };
}

// ─── Bulk Actions ─────────────────────────────────────────────────────────────

/**
 * Confirm multiple applications at once.
 * Useful for batch processing applications.
 */
export function confirmMultipleApplications(
  applicationIds: string[],
  posterNote?: string,
): {
  successful: Application[];
  failed: { id: string; reason: string }[];
} {
  const { confirmApplication } = useApplicationStore.getState();

  const successful: Application[] = [];
  const failed: { id: string; reason: string }[] = [];

  applicationIds.forEach((id) => {
    const result = confirmApplication(id, posterNote);
    if (result.success && result.application) {
      successful.push(result.application);
    } else {
      failed.push({
        id,
        reason: result.reason || "unknown_error",
      });
    }
  });

  return { successful, failed };
}

/**
 * Reject multiple applications at once.
 */
export function rejectMultipleApplications(
  applicationIds: string[],
  posterNote?: string,
): {
  successful: Application[];
  failed: { id: string; reason: string }[];
} {
  const { rejectApplication } = useApplicationStore.getState();

  const successful: Application[] = [];
  const failed: { id: string; reason: string }[] = [];

  applicationIds.forEach((id) => {
    const result = rejectApplication(id, posterNote);
    if (result.success && result.application) {
      successful.push(result.application);
    } else {
      failed.push({
        id,
        reason: result.reason || "unknown_error",
      });
    }
  });

  return { successful, failed };
}

// ─── Mock Data for Testing ────────────────────────────────────────────────────

/**
 * Seed some sample applications for testing.
 * Uses the actual job IDs from hire.tsx mock data.
 */
export function seedMockApplications() {
  const { submitApplication, confirmApplication, waitlistApplication } =
    useApplicationStore.getState();

  // Job IDs from hire.tsx: "1", "2", "3"
  // Worker IDs simulated

  const sampleApplications = [
    // Job 1: Banquet servers for wedding (8 positions, 6 confirmed)
    {
      workerId: "worker_1",
      jobId: "1",
      workerNote: "I have 5 years of banquet service experience.",
    },
    {
      workerId: "worker_2",
      jobId: "1",
      workerNote: "Available for the full shift. Punctual and professional.",
    },
    {
      workerId: "worker_3",
      jobId: "1",
      workerNote: "Experienced wedding server, excellent with guests.",
    },
    { workerId: "worker_4", jobId: "1" },
    { workerId: "worker_5", jobId: "1", workerNote: "Can bring my own uniform if needed." },
    { workerId: "worker_6", jobId: "1" },
    { workerId: "worker_7", jobId: "1", workerNote: "Have worked at Grand Palm before." },
    { workerId: "worker_8", jobId: "1" },

    // Job 2: Kitchen helpers (4 positions, 4 confirmed - fully filled)
    { workerId: "worker_9", jobId: "2", workerNote: "Experienced kitchen helper." },
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
