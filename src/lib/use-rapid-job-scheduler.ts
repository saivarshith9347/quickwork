import { useEffect, useRef } from "react";
import { createRapidJobScheduler, type RapidJobScheduler, type RapidJobSchedulerConfig } from "./rapid-job-scheduler";
import type { BaseJob } from "./job-types";

interface UseRapidJobSchedulerOptions {
  /**
   * Interval in milliseconds between checks (default: 60000 = 1 minute)
   */
  checkInterval?: number;
  
  /**
   * Callback fired when rapid jobs need status updates
   */
  onUpdate?: (updates: Array<{
    jobId: string;
    shouldHide: boolean;
    newStatus?: string;
    reason: string;
  }>) => void;
  
  /**
   * Callback for logging scheduler events
   */
  onLog?: (message: string) => void;
  
  /**
   * Whether to start the scheduler immediately (default: true)
   */
  autoStart?: boolean;
  
  /**
   * Function to fetch all jobs for checking
   */
  getJobs?: () => BaseJob[];
}

/**
 * React hook for managing the rapid job scheduler lifecycle.
 * Automatically starts/stops the scheduler with component mount/unmount.
 * 
 * @example
 * ```tsx
 * function App() {
 *   useRapidJobScheduler({
 *     checkInterval: 60000, // Check every minute
 *     onUpdate: (updates) => {
 *       updates.forEach(update => {
 *         console.log(`Job ${update.jobId}: ${update.reason}`);
 *         // Update job status in your state management
 *       });
 *     },
 *     onLog: console.log,
 *   });
 * 
 *   return <YourApp />;
 * }
 * ```
 */
export function useRapidJobScheduler(options: UseRapidJobSchedulerOptions = {}) {
  const schedulerRef = useRef<RapidJobScheduler | null>(null);
  const {
    checkInterval = 60000, // 1 minute default
    onUpdate,
    onLog,
    autoStart = true,
    getJobs,
  } = options;

  useEffect(() => {
    // Create scheduler instance with proper config handling
    const config: RapidJobSchedulerConfig = {
      checkInterval: checkInterval ?? 30000,
    };
    
    if (onUpdate) config.onUpdate = onUpdate;
    if (onLog) config.onLog = onLog;
    
    schedulerRef.current = createRapidJobScheduler(config);

    // Start if autoStart is enabled
    if (autoStart) {
      schedulerRef.current.start();
    }

    // Cleanup: stop scheduler on unmount
    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.stop();
      }
    };
  }, [checkInterval, onUpdate, onLog, autoStart, getJobs]);

  return schedulerRef.current;
}

/**
 * Simplified hook that just runs the scheduler without exposing the instance.
 * Good for when you just want automatic checking without manual control.
 * 
 * @example
 * ```tsx
 * function App() {
 *   useAutoRapidJobCheck({
 *     onExpiry: (jobId) => console.log(`Job ${jobId} expired`),
 *   });
 *   return <YourApp />;
 * }
 * ```
 */
export function useAutoRapidJobCheck(options: {
  checkInterval?: number;
  onExpiry?: (jobId: string, reason: string) => void;
  getJobs?: () => BaseJob[];
} = {}) {
  useRapidJobScheduler({
    checkInterval: options.checkInterval ?? 30000,
    onUpdate: (updates) => {
      updates.forEach((update) => {
        if (update.shouldHide && options.onExpiry) {
          options.onExpiry(update.jobId, update.reason);
        }
      });
    },
    onLog: (message) => {
      // Log to console in development only
      if (import.meta.env.DEV) {
        console.log(`[RapidJobScheduler] ${message}`);
      }
    },
    ...(options.getJobs !== undefined && { getJobs: options.getJobs }),
    autoStart: true,
  });
}
