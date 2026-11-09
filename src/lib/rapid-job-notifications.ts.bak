/**
 * Rapid Job Notification System
 * 
 * Handles push notifications for eligible workers when a Rapid Job is posted.
 * Only notifies workers who match specific criteria to avoid spam.
 */

import type { BaseJob } from "./job-types";

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

// ─── Mock Worker Database ─────────────────────────────────────────────────────

// In real app, this would be fetched from database
const mockWorkerProfiles: WorkerProfile[] = [
  {
    id: "worker-1",
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    categories: ["hospitality", "events"],
    location: { lat: 12.9716, lng: 77.5946 }, // Bangalore
    availabilityStatus: "available",
    isVerified: true,
    rating: 4.8,
    totalShifts: 85,
    pushToken: "mock-push-token-1",
    notificationPreferences: {
      rapidJobAlerts: true,
      maxDistanceKm: 5,
    },
  },
  {
    id: "worker-2",
    name: "Rahul Kumar",
    email: "rahul@example.com",
    phone: "+91 98765 43211",
    categories: ["hospitality", "warehouse"],
    location: { lat: 12.9816, lng: 77.6046 }, // ~1.5km away
    availabilityStatus: "available",
    isVerified: true,
    rating: 4.5,
    totalShifts: 120,
    pushToken: "mock-push-token-2",
    notificationPreferences: {
      rapidJobAlerts: true,
      maxDistanceKm: 8,
    },
  },
  {
    id: "worker-3",
    name: "Anjali Patel",
    email: "anjali@example.com",
    phone: "+91 98765 43212",
    categories: ["events", "delivery"],
    location: { lat: 12.9616, lng: 77.5846 }, // ~1km away
    availabilityStatus: "busy",
    isVerified: false,
    rating: 4.2,
    totalShifts: 45,
    pushToken: "mock-push-token-3",
    notificationPreferences: {
      rapidJobAlerts: true,
      maxDistanceKm: 3,
    },
  },
  {
    id: "worker-4",
    name: "Vikram Singh",
    email: "vikram@example.com",
    phone: "+91 98765 43213",
    categories: ["hospitality"],
    location: { lat: 12.9916, lng: 77.6146 }, // ~2.5km away
    availabilityStatus: "available",
    isVerified: true,
    rating: 4.9,
    totalShifts: 200,
    pushToken: "mock-push-token-4",
    notificationPreferences: {
      rapidJobAlerts: true,
      maxDistanceKm: 10,
    },
  },
  {
    id: "worker-5",
    name: "Sneha Reddy",
    email: "sneha@example.com",
    phone: "+91 98765 43214",
    categories: ["warehouse", "delivery"],
    location: { lat: 12.9516, lng: 77.5746 }, // ~2km away
    availabilityStatus: "available",
    isVerified: false,
    rating: 4.0,
    totalShifts: 30,
    pushToken: "mock-push-token-5",
    notificationPreferences: {
      rapidJobAlerts: false, // Opted out
      maxDistanceKm: 5,
    },
  },
];

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
  action: "applied" | "dismissed" | "viewed"
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
  
  console.log(`📝 Recorded response: ${workerId} ${action} job ${jobId}`);
}

/**
 * Get workers who already responded to a job
 */
function getRespondedWorkers(jobId: string): Set<string> {
  const responses = workerResponses.get(jobId) || [];
  return new Set(responses.map(r => r.workerId));
}

/**
 * Get workers who were already notified for a job
 */
function getNotifiedWorkers(jobId: string): Set<string> {
  const notifications = notificationLog.get(jobId) || [];
  return new Set(notifications.map(n => n.workerId));
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

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
function isWorkerEligible(worker: WorkerProfile, job: Job, distance: number): boolean {
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
function calculateWorkerPriority(
  worker: WorkerProfile,
  distance: number
): number {
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
 * Find all eligible workers for a Rapid Job
 */
export function findEligibleWorkers(job: Job): Array<{
  worker: WorkerProfile;
  distance: number;
  priority: number;
}> {
  const eligible: Array<{
    worker: WorkerProfile;
    distance: number;
    priority: number;
  }> = [];

  // Parse job location (in real app, would be lat/lng from venue)
  // For now, using mock coordinates based on area
  const jobLocation = getJobLocationCoordinates(job.area);

  for (const worker of mockWorkerProfiles) {
    const distance = calculateDistance(
      jobLocation.lat,
      jobLocation.lng,
      worker.location.lat,
      worker.location.lng
    );

    if (isWorkerEligible(worker, job, distance)) {
      const priority = calculateWorkerPriority(worker, distance);
      eligible.push({ worker, distance, priority });
    }
  }

  // Sort by priority (highest first)
  eligible.sort((a, b) => b.priority - a.priority);

  // Limit to max workers
  return eligible.slice(0, NOTIFICATION_CONFIG.MAX_WORKERS_TO_NOTIFY);
}

/**
 * Get coordinates for a job location (mock implementation)
 * In real app, would geocode the venue address
 */
function getJobLocationCoordinates(area: string): { lat: number; lng: number } {
  // Mock coordinates for different areas in Bangalore
  const areaCoordinates: Record<string, { lat: number; lng: number }> = {
    "Koramangala": { lat: 12.9352, lng: 77.6245 },
    "Indiranagar": { lat: 12.9716, lng: 77.6412 },
    "Whitefield": { lat: 12.9698, lng: 77.7499 },
    "MG Road": { lat: 12.9759, lng: 77.6061 },
    "Electronic City": { lat: 12.8456, lng: 77.6603 },
    "Jayanagar": { lat: 12.9250, lng: 77.5838 },
  };

  return areaCoordinates[area] || { lat: 12.9716, lng: 77.5946 }; // Default to city center
}

/**
 * Send push notification to a worker
 * In real app, would use Firebase Cloud Messaging or similar service
 */
async function sendPushNotification(
  worker: WorkerProfile,
  job: Job,
  distance: number,
  isReminder: boolean = false
): Promise<boolean> {
  try {
    const notification = {
      title: isReminder 
        ? `⏰ Reminder: ${job.jobTitle} Still Available`
        : `⚡ Rapid Job Alert: ${job.jobTitle}`,
      body: isReminder
        ? `Still need ${job.positionsRemaining || job.positionsTotal} workers • ${job.wageDisplay} • ${distance} km away`
        : `${job.positionsTotal} positions • ${job.wageDisplay} • ${distance} km away`,
      data: {
        jobId: job.id,
        jobTitle: job.jobTitle,
        category: job.category,
        positionsNeeded: (job.positionsRemaining || job.positionsTotal).toString(),
        startTime: formatStartTime(job.date, job.startTime),
        wage: job.wageDisplay,
        distance: `${distance} km`,
        venueName: job.venueName,
        area: job.area,
        type: isReminder ? "rapid_job_reminder" : "rapid_job",
        isReminder: isReminder.toString(),
      },
      sound: "default",
      badge: 1,
      priority: "high",
      channelId: "rapid-jobs",
    };

    // In real app, would call FCM/APNS:
    // await sendToDevice(worker.pushToken, notification);
    
    console.log(`📱 ${isReminder ? "REMINDER" : "Notification"} sent to ${worker.name}:`, notification.title);

    return true;
  } catch (error) {
    console.error(`Failed to send notification to ${worker.name}:`, error);
    return false;
  }
}

/**
 * Main function: Notify eligible workers about a Rapid Job
 */
export async function notifyEligibleWorkers(
  job: Job,
  isReminder: boolean = false
): Promise<{
  totalNotified: number;
  notifications: RapidJobNotification[];
  eligibleWorkers: number;
}> {
  // Only process if it's a Rapid Job
  if (!job.isRapidJob) {
    return {
      totalNotified: 0,
      notifications: [],
      eligibleWorkers: 0,
    };
  }

  const eligible = findEligibleWorkers(job);
  const notifications: RapidJobNotification[] = [];
  let successCount = 0;

  // If this is a reminder, filter out workers who already responded
  let workersToNotify = eligible;
  if (isReminder) {
    const respondedWorkers = getRespondedWorkers(job.id);
    workersToNotify = eligible.filter(
      ({ worker }) => !respondedWorkers.has(worker.id)
    );

    console.log(`\n⏰ REMINDER NOTIFICATION for: ${job.jobTitle}`);
    console.log(`📍 Location: ${job.venueName}, ${job.area}`);
    console.log(`👥 Original eligible: ${eligible.length} workers`);
    console.log(`🚫 Already responded: ${respondedWorkers.size} workers`);
    console.log(`✅ To notify: ${workersToNotify.length} workers\n`);
  } else {
    console.log(`\n🚀 Processing Rapid Job: ${job.jobTitle}`);
    console.log(`📍 Location: ${job.venueName}, ${job.area}`);
    console.log(`👥 Found ${eligible.length} eligible workers\n`);
  }

  for (const { worker, distance, priority } of workersToNotify) {
    console.log(
      `   → ${worker.name}: ${distance}km away, priority ${priority.toFixed(1)} ${worker.isVerified ? "✓" : ""}`
    );

    const success = await sendPushNotification(worker, job, distance, isReminder);

    const notification: RapidJobNotification = {
      workerId: worker.id,
      jobId: job.id,
      jobTitle: job.jobTitle,
      positionsNeeded: job.positionsRemaining || job.positionsTotal,
      startTime: formatStartTime(job.date, job.startTime),
      wage: job.wageDisplay,
      distance: `${distance} km`,
      venueName: job.venueName,
      category: job.category,
      sentAt: new Date(),
      status: success ? "sent" : "failed",
      isReminder,
    };

    notifications.push(notification);
    logNotification(notification);

    if (success) {
      successCount++;
    }
  }

  console.log(
    `\n✅ Successfully notified ${successCount}/${workersToNotify.length} workers\n`
  );

  return {
    totalNotified: successCount,
    notifications,
    eligibleWorkers: workersToNotify.length,
  };
}

/**
 * Get notification statistics for a job
 */
export function getNotificationStats(jobId: string): {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
} {
  // In real app, would fetch from database
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    failed: 0,
  };
}

/**
 * Schedule a reminder notification for a Rapid Job
 * Automatically sends after REMINDER_DELAY_MS if job is still unfilled
 */
export function scheduleReminderNotification(
  job: Job,
  getCurrentJobStatus: () => {
    positionsRemaining: number;
    isCancelled: boolean;
  }
): void {
  if (!job.isRapidJob) {
    return;
  }

  // Clear any existing reminder for this job
  const existingTimer = reminderTimers.get(job.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  console.log(
    `⏰ Scheduled reminder for "${job.jobTitle}" in ${NOTIFICATION_CONFIG.REMINDER_DELAY_MS / 1000 / 60} minutes`
  );

  const timer = setTimeout(async () => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`⏰ REMINDER TIMER TRIGGERED for: ${job.jobTitle}`);
    console.log(`${"=".repeat(60)}\n`);

    // Check current job status
    const status = getCurrentJobStatus();

    console.log(`📊 Current Status:`);
    console.log(`   Positions remaining: ${status.positionsRemaining}`);
    console.log(`   Is cancelled: ${status.isCancelled}`);

    // Don't send reminder if job is filled or cancelled
    if (status.isCancelled) {
      console.log(`\n❌ Job was cancelled - skipping reminder\n`);
      reminderTimers.delete(job.id);
      return;
    }

    if (status.positionsRemaining < NOTIFICATION_CONFIG.MIN_UNFILLED_FOR_REMINDER) {
      console.log(`\n✅ Job is filled - skipping reminder\n`);
      reminderTimers.delete(job.id);
      return;
    }

    // Update job with current positions remaining
    const updatedJob = {
      ...job,
      positionsRemaining: status.positionsRemaining,
    };

    // Send reminder to eligible workers who haven't responded
    console.log(`\n📢 Sending reminder notifications...\n`);
    const result = await notifyEligibleWorkers(updatedJob, true);

    if (result.totalNotified > 0) {
      console.log(
        `\n✅ Reminder sent to ${result.totalNotified} workers who haven't responded\n`
      );
    } else {
      console.log(`\n⚠️  No eligible workers to remind (all already responded)\n`);
    }

    // Clean up timer
    reminderTimers.delete(job.id);
  }, NOTIFICATION_CONFIG.REMINDER_DELAY_MS);

  reminderTimers.set(job.id, timer);
}

/**
 * Cancel a scheduled reminder (e.g., if job gets filled or cancelled)
 */
export function cancelReminderNotification(jobId: string): void {
  const timer = reminderTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    reminderTimers.delete(jobId);
    console.log(`🚫 Cancelled reminder for job ${jobId}`);
  }
}

/**
 * Get all active reminder timers (for debugging)
 */
export function getActiveReminders(): string[] {
  return Array.from(reminderTimers.keys());
}

/**
 * Test function to simulate notification system
 */
export function testRapidJobNotifications(job: Job): void {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTING RAPID JOB NOTIFICATION SYSTEM");
  console.log("=".repeat(60));

  const eligible = findEligibleWorkers(job);

  console.log(`\n📋 Job Details:`);
  console.log(`   Title: ${job.jobTitle}`);
  console.log(`   Category: ${job.category}`);
  console.log(`   Location: ${job.venueName}, ${job.area}`);
  console.log(`   Positions: ${job.positionsTotal}`);
  console.log(`   Wage: ${job.wageDisplay}`);
  console.log(`   Is Rapid: ${job.isRapidJob ? "✅ Yes" : "❌ No"}`);

  console.log(`\n📊 Worker Screening Results:`);
  console.log(`   Total workers in system: ${mockWorkerProfiles.length}`);
  console.log(`   Eligible workers found: ${eligible.length}`);

  if (eligible.length === 0) {
    console.log(`\n⚠️  No eligible workers found for this job.`);
  } else {
    console.log(`\n👥 Eligible Workers (sorted by priority):\n`);
    eligible.forEach(({ worker, distance, priority }, index) => {
      console.log(`   ${index + 1}. ${worker.name}`);
      console.log(`      ⭐ Rating: ${worker.rating} (${worker.totalShifts} shifts)`);
      console.log(`      📍 Distance: ${distance} km`);
      console.log(`      🎯 Priority: ${priority.toFixed(1)}`);
      console.log(`      ${worker.isVerified ? "✓ Verified" : "○ Not verified"}`);
      console.log(`      📱 Push token: ${worker.pushToken ? "✓" : "✗"}`);
      console.log("");
    });
  }

  console.log("=".repeat(60) + "\n");
}
