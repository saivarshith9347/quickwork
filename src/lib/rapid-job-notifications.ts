/**
 * Rapid Job Notification System
 *
 * Handles push notifications for eligible workers when a Rapid Job is posted.
 * Only notifies workers who match specific criteria to avoid spam.
 */

import type { BaseJob, JobLocationValue } from "./job-types";
import { isStructuredLocation, getLocationArea } from "./job-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkerAvailabilityStatus = "available" | "busy" | "unavailable";

export type WorkerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  categories: string[]; // Job categories they work in (e.g., ["hospitality", "events"])
  location: {
    lat: number;
    lng: number;
  };
  availabilityStatus: WorkerAvailabilityStatus;
  isVerified: boolean;
  rating: number;
  totalShifts: number;
  pushToken?: string; // Device push notification token
  notificationPreferences: {
    rapidJobAlerts: boolean;
    maxDistanceKm: number; // Maximum distance they want to be notified for
  };
};

export type RapidJobNotification = {
  workerId: string;
  jobId: string;
  jobTitle: string;
  positionsNeeded: number;
  startTime: string; // e.g., "2:00 PM Today"
  wage: string;
  distance: string; // e.g., "1.2 km"
  venueName: string;
  category: string;
  sentAt: Date;
  status: "sent" | "failed" | "delivered" | "opened";
  isReminder?: boolean; // True for follow-up notifications
};

export type WorkerResponse = {
  workerId: string;
  jobId: string;
  action: "applied" | "dismissed" | "viewed" | "no_response";
  timestamp: Date;
};

// ─── Configuration ────────────────────────────────────────────────────────────

const NOTIFICATION_CONFIG = {
  // Maximum distance to notify workers (in kilometers)
  MAX_NOTIFICATION_DISTANCE_KM: 10,

  // Minimum rating for workers to receive notifications
  MIN_WORKER_RATING: 3.5,

  // Maximum number of workers to notify per job
  MAX_WORKERS_TO_NOTIFY: 50,

  // Priority boost for verified workers
  VERIFIED_PRIORITY_BOOST: 0.5,

  // Reminder notification delay (in milliseconds)
  REMINDER_DELAY_MS: 15 * 60 * 1000, // 15 minutes

  // Minimum unfilled positions to trigger reminder
  MIN_UNFILLED_FOR_REMINDER: 1,
};

// ─── Notification Tracking ────────────────────────────────────────────────────

// In real app, this would be stored in database (Redis or DB)
// Tracks which workers were notified for each job
const notificationLog: Map<string, RapidJobNotification[]> = new Map();

// Tracks worker responses (applied, dismissed, etc.)
const workerResponses: Map<string, WorkerResponse[]> = new Map();

// Tracks scheduled reminder jobs
const reminderTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Log a notification
 */
function logNotification(notification: RapidJobNotification): void {
  const jobId = notification.jobId;
  const existing = notificationLog.get(jobId) || [];
  existing.push(notification);
  notificationLog.set(jobId, existing);
}

/**
 * Record worker response (applied or dismissed)
 */
export function recordWorkerResponse(
  workerId: string,
  jobId: string,
  action: "applied" | "dismissed" | "viewed",
): void {
  const key = `${jobId}`;
  const existing = workerResponses.get(key) || [];

  existing.push({
    workerId,
    jobId,
    action,
    timestamp: new Date(),
  });

  workerResponses.set(key, existing);
}

/**
 * Get workers who already responded to a job
 */
function getRespondedWorkers(jobId: string): Set<string> {
  const responses = workerResponses.get(jobId) || [];
  return new Set(responses.map((r) => r.workerId));
}

/**
 * Get workers who were already notified for a job
 */
function getNotifiedWorkers(jobId: string): Set<string> {
  const notifications = notificationLog.get(jobId) || [];
  return new Set(notifications.map((n) => n.workerId));
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format time for notification (e.g., "2:00 PM Today")
 */
function formatStartTime(jobDate: string, startTime: string): string {
  const jobDateTime = new Date(jobDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = jobDateTime.toDateString() === today.toDateString();
  const isTomorrow = jobDateTime.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `${startTime} Today`;
  } else if (isTomorrow) {
    return `${startTime} Tomorrow`;
  } else {
    const dateStr = jobDateTime.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
    return `${startTime} on ${dateStr}`;
  }
}

// ─── Eligibility Filtering ────────────────────────────────────────────────────

/**
 * Check if a worker is eligible to receive notification for a job
 */
function isWorkerEligible(worker: WorkerProfile, job: BaseJob, distance: number): boolean {
  // 1. Must have rapid job alerts enabled
  if (!worker.notificationPreferences.rapidJobAlerts) {
    return false;
  }

  // 2. Must be marked as available
  if (worker.availabilityStatus !== "available") {
    return false;
  }

  // 3. Must match job category
  if (!worker.categories.includes(job.category)) {
    return false;
  }

  // 4. Must be within worker's preferred distance
  if (distance > worker.notificationPreferences.maxDistanceKm) {
    return false;
  }

  // 5. Must be within system's max distance
  if (distance > NOTIFICATION_CONFIG.MAX_NOTIFICATION_DISTANCE_KM) {
    return false;
  }

  // 6. Must meet minimum rating requirement
  if (worker.rating < NOTIFICATION_CONFIG.MIN_WORKER_RATING) {
    return false;
  }

  // 7. Must have a push token
  if (!worker.pushToken) {
    return false;
  }

  return true;
}

/**
 * Calculate priority score for a worker
 * Higher score = higher priority for notification
 */
function calculateWorkerPriority(worker: WorkerProfile, distance: number): number {
  let score = 0;

  // Rating contribution (0-50 points)
  score += (worker.rating / 5) * 50;

  // Distance contribution (closer is better, 0-30 points)
  const distanceScore = Math.max(0, 30 - distance * 3);
  score += distanceScore;

  // Experience contribution (0-15 points)
  const experienceScore = Math.min(worker.totalShifts / 10, 15);
  score += experienceScore;

  // Verification bonus (5 points)
  if (worker.isVerified) {
    score += NOTIFICATION_CONFIG.VERIFIED_PRIORITY_BOOST * 10;
  }

  return score;
}

// ─── Main Notification Functions ──────────────────────────────────────────────

/**
 * Get notification statistics for a job
 */
export function getNotificationStats(jobId: string): {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
} {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    failed: 0,
  };
}

/**
 * Schedule a reminder notification for a Rapid Job
 * Placeholder for future implementation
 */
export function scheduleReminderNotification(
  job: BaseJob,
  getCurrentJobStatus: () => {
    positionsRemaining: number;
    isCancelled: boolean;
  },
): void {
  // Future: implement reminder notifications with real worker database
}

/**
 * Cancel a scheduled reminder
 */
export function cancelReminderNotification(jobId: string): void {
  const timer = reminderTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    reminderTimers.delete(jobId);
  }
}

/**
 * Get all active reminder timers
 */
export function getActiveReminders(): string[] {
  return Array.from(reminderTimers.keys());
}
