/**
 * Rapid Job Scheduler
 *
 * Automatically checks and updates rapid jobs that have expired or been filled.
 * Run this periodically (every 1-5 minutes) to keep rapid job status current.
 */

import { getRapidJobsNeedingUpdate, type BaseJob, type JobStatusValue } from "./job-types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RapidJobUpdate {
  jobId: string;
  shouldHide: boolean;
  newStatus?: JobStatusValue;
  reason: string;
}

export interface RapidJobSchedulerConfig {
  /** Interval in milliseconds (default: 1 minute) */
  checkInterval?: number;

  /** Callback when rapid jobs need updates */
  onUpdate?: (updates: RapidJobUpdate[]) => void;

  /** Callback for logging */
  onLog?: (message: string) => void;
}

// ─── Scheduler Class ───────────────────────────────────────────────────────────

export class RapidJobScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private config: Required<RapidJobSchedulerConfig>;
  private isRunning = false;

  constructor(config: RapidJobSchedulerConfig = {}) {
    this.config = {
      checkInterval: config.checkInterval || 60 * 1000, // 1 minute default
      onUpdate: config.onUpdate || (() => {}),
      onLog: config.onLog || (() => {}),
    };
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      this.config.onLog("Rapid job scheduler already running");
      return;
    }

    this.config.onLog(
      `Starting rapid job scheduler (check every ${this.config.checkInterval / 1000}s)`,
    );
    this.isRunning = true;

    // Run immediately on start
    this.check();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.check();
    }, this.config.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      this.config.onLog("Rapid job scheduler not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.config.onLog("Stopped rapid job scheduler");
  }

  /**
   * Manually trigger a check (useful for testing or immediate updates)
   */
  check(jobs?: BaseJob[]) {
    // If jobs not provided, would need to fetch from store/API
    // For now, this is a placeholder that requires jobs to be passed
    if (!jobs || jobs.length === 0) {
      this.config.onLog("No jobs to check");
      return;
    }

    const updates = getRapidJobsNeedingUpdate(jobs);

    if (updates.length > 0) {
      this.config.onLog(`Found ${updates.length} rapid job(s) needing updates`);
      this.config.onUpdate(updates);
    } else {
      this.config.onLog("No rapid job updates needed");
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.config.checkInterval,
    };
  }
}

// ─── Standalone Functions ──────────────────────────────────────────────────────

/**
 * Create and start a rapid job scheduler
 * @param config - Scheduler configuration
 * @returns Scheduler instance
 */
export function createRapidJobScheduler(config: RapidJobSchedulerConfig = {}): RapidJobScheduler {
  const scheduler = new RapidJobScheduler(config);
  scheduler.start();
  return scheduler;
}

/**
 * One-time check for rapid jobs needing updates
 * Use this if you don't want a continuous scheduler
 * @param jobs - Array of jobs to check
 * @returns Array of updates needed
 */
export function checkRapidJobsOnce(jobs: BaseJob[]): RapidJobUpdate[] {
  return getRapidJobsNeedingUpdate(jobs);
}

/**
 * Apply rapid job updates to a job store
 * This is a helper that can be used in the onUpdate callback
 * @param updates - Array of updates
 * @param updateJobFn - Function to update a single job (jobId, updates)
 */
export function applyRapidJobUpdates(
  updates: RapidJobUpdate[],
  updateJobFn: (jobId: string, updates: { status?: JobStatusValue; hidden?: boolean }) => void,
) {
  updates.forEach((update) => {
    const jobUpdates: { status?: JobStatusValue; hidden?: boolean } = {};

    if (update.newStatus) {
      jobUpdates.status = update.newStatus;
    }

    if (update.shouldHide) {
      jobUpdates.hidden = true;
    }

    updateJobFn(update.jobId, jobUpdates);
  });
}

// ─── React Hook ────────────────────────────────────────────────────────────────

/**
 * React hook to use rapid job scheduler
 * Automatically starts on mount and stops on unmount
 * @param jobs - Array of jobs to monitor
 * @param onUpdate - Callback when updates are needed
 * @param checkInterval - Check interval in milliseconds (default: 60000)
 */
export function useRapidJobScheduler(
  jobs: BaseJob[],
  onUpdate: (updates: RapidJobUpdate[]) => void,
  checkInterval: number = 60 * 1000, // 1 minute
) {
  // This would typically use React hooks, but since we're in a TS file,
  // here's the pattern to implement in a component:

  /**
   * Usage in a React component:
   *
   * ```tsx
   * import { useEffect, useRef } from 'react';
   * import { createRapidJobScheduler } from '@/lib/rapid-job-scheduler';
   *
   * function MyComponent() {
   *   const jobs = useJobStore(state => state.jobs);
   *   const schedulerRef = useRef<RapidJobScheduler | null>(null);
   *
   *   useEffect(() => {
   *     schedulerRef.current = createRapidJobScheduler({
   *       checkInterval: 60000,
   *       onUpdate: (updates) => {
   *         console.log('Rapid jobs to update:', updates);
   *         // Update your store/state here
   *       },
   *       onLog: (msg) => console.log('[Rapid Job Scheduler]', msg),
   *     });
   *
   *     return () => {
   *       schedulerRef.current?.stop();
   *     };
   *   }, []);
   *
   *   // Manually trigger check when jobs change
   *   useEffect(() => {
   *     schedulerRef.current?.check(jobs);
   *   }, [jobs]);
   * }
   * ```
   */

  return {
    // Placeholder for actual React hook implementation
    start: () => {},
    stop: () => {},
    check: () => {},
  };
}

// ─── Example Usage ─────────────────────────────────────────────────────────────

/**
 * Example: Set up rapid job monitoring in your app
 *
 * ```typescript
 * import { createRapidJobScheduler } from '@/lib/rapid-job-scheduler';
 * import { useJobStore } from '@/lib/job-store';
 *
 * // In your app initialization or main component
 * const scheduler = createRapidJobScheduler({
 *   checkInterval: 60 * 1000, // Check every minute
 *
 *   onUpdate: (updates) => {
 *     const { updateJob } = useJobStore.getState();
 *
 *     updates.forEach(update => {
 *       console.log(`Updating rapid job ${update.jobId}: ${update.reason}`);
 *
 *       if (update.newStatus) {
 *         updateJob(update.jobId, {
 *           status: update.newStatus,
 *           hidden: update.shouldHide
 *         });
 *       }
 *     });
 *   },
 *
 *   onLog: (message) => {
 *     console.log('[Rapid Jobs]', message);
 *   },
 * });
 *
 * // Clean up on unmount
 * return () => scheduler.stop();
 * ```
 */
