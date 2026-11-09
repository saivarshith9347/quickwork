/**
 * Application-Job Synchronization Utilities
 *
 * Connects the Application Model with the Job Model to auto-update
 * job position tracking when applications are confirmed or rejected.
 */

import { useApplicationStore } from "./application-model";
import { calculateJobStatus, type JobStatusValue } from "./job-types";

/**
 * Sync job positions with confirmed applications
 * Call this after confirming/rejecting applications to update the job
 */
export function syncJobWithApplications(jobId: string): {
  positionsConfirmed: number;
  positionsRemaining: number;
  suggestedStatus: JobStatusValue;
} {
  const getConfirmedCount = useApplicationStore.getState().getConfirmedCount;

  // Get confirmed application count
  const positionsConfirmed = getConfirmedCount(jobId);

  // Note: positionsRequired and positionsRemaining should come from job data
  // This is a helper that returns the confirmed count for updating the job
  return {
    positionsConfirmed,
    positionsRemaining: 0, // Will be calculated by job model
    suggestedStatus: "Open" as JobStatusValue, // Will be calculated by job model
  };
}

/**
 * Get updated job data after application status changes
 * Use this to update a job's position tracking
 */
export function getUpdatedJobPositions(
  jobId: string,
  positionsRequired: number,
  jobDate: string,
  currentStatus?: JobStatusValue,
): {
  positionsConfirmed: number;
  positionsRemaining: number;
  status: JobStatusValue;
} {
  const getConfirmedCount = useApplicationStore.getState().getConfirmedCount;

  const positionsConfirmed = getConfirmedCount(jobId);
  const positionsRemaining = Math.max(0, positionsRequired - positionsConfirmed);

  // Calculate status based on positions and date
  const status = calculateJobStatus(positionsRequired, positionsConfirmed, jobDate, currentStatus);

  return {
    positionsConfirmed,
    positionsRemaining,
    status,
  };
}

/**
 * Hook to handle application confirmation with automatic job updates
 */
export function useApplicationJobSync() {
  const { confirmApplication, rejectApplication, waitlistApplication, getConfirmedCount } =
    useApplicationStore();

  /**
   * Confirm application and return updated job positions
   */
  const confirmWithSync = (
    applicationId: string,
    posterNote?: string,
  ): {
    success: boolean;
    application: any | null;
    jobId?: string;
    confirmedCount?: number;
  } => {
    const result = confirmApplication(applicationId, posterNote);

    if (result.success && result.application) {
      const jobId = result.application.jobId;
      const confirmedCount = getConfirmedCount(jobId);

      return {
        ...result,
        jobId,
        confirmedCount,
      };
    }

    return result;
  };

  /**
   * Reject application and return updated job positions
   */
  const rejectWithSync = (
    applicationId: string,
    posterNote?: string,
  ): {
    success: boolean;
    application: any | null;
    jobId?: string;
    confirmedCount?: number;
  } => {
    const result = rejectApplication(applicationId, posterNote);

    if (result.success && result.application) {
      const jobId = result.application.jobId;
      const confirmedCount = getConfirmedCount(jobId);

      return {
        ...result,
        jobId,
        confirmedCount,
      };
    }

    return result;
  };

  /**
   * Waitlist application (no position changes needed)
   */
  const waitlistWithSync = (applicationId: string, posterNote?: string) => {
    return waitlistApplication(applicationId, posterNote);
  };

  return {
    confirmWithSync,
    rejectWithSync,
    waitlistWithSync,
    getConfirmedCount,
  };
}

/**
 * Create a reactive effect that auto-updates job positions when applications change
 * This would typically be set up in a provider or at app initialization
 */
export function setupApplicationJobSync(
  updateJobCallback: (
    jobId: string,
    updates: {
      positionsConfirmed: number;
      positionsRemaining: number;
      status: JobStatusValue;
    },
  ) => void,
) {
  // Subscribe to application store changes
  // Note: Actual implementation would depend on your state management
  // This is a conceptual example

  return () => {
    // Cleanup function
  };
}

/**
 * Bulk confirm applications and update job positions
 */
export function bulkConfirmWithSync(
  applicationIds: string[],
  posterNote?: string,
): {
  successful: number;
  failed: number;
  jobUpdates: Record<string, number>; // jobId -> confirmedCount
} {
  const confirmApplication = useApplicationStore.getState().confirmApplication;
  const getConfirmedCount = useApplicationStore.getState().getConfirmedCount;

  let successful = 0;
  let failed = 0;
  const jobUpdates: Record<string, number> = {};

  applicationIds.forEach((id) => {
    const result = confirmApplication(id, posterNote);

    if (result.success && result.application) {
      successful++;
      const jobId = result.application.jobId;
      jobUpdates[jobId] = getConfirmedCount(jobId);
    } else {
      failed++;
    }
  });

  return {
    successful,
    failed,
    jobUpdates,
  };
}

/**
 * Check if job can accept more applications
 * Based on confirmed positions vs required positions
 */
export function canJobAcceptApplications(
  jobId: string,
  positionsRequired: number,
): {
  canAccept: boolean;
  reason?: string;
  positionsRemaining: number;
} {
  const getConfirmedCount = useApplicationStore.getState().getConfirmedCount;

  const positionsConfirmed = getConfirmedCount(jobId);
  const positionsRemaining = Math.max(0, positionsRequired - positionsConfirmed);

  if (positionsRemaining === 0) {
    return {
      canAccept: false,
      reason: "All positions filled",
      positionsRemaining: 0,
    };
  }

  return {
    canAccept: true,
    positionsRemaining,
  };
}
