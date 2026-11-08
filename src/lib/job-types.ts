/**
 * Shared job type definitions for QuickWork.
 * This file defines the core job data model used across the application.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum JobCategory {
  Hospitality = "Hospitality",
  Events = "Events",
  Delivery = "Delivery",
  Retail = "Retail",
  Construction = "Construction",
  Warehouse = "Warehouse",
  Cleaning = "Cleaning",
  Other = "Other",
}

export enum JobType {
  OneTime = "one-time",
  MultipleDays = "multiple-days",
  Recurring = "recurring",
}

export enum JobStatus {
  Open = "Open",
  PartiallyFilled = "PartiallyFilled",
  FullyFilled = "FullyFilled",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

// ─── Type Aliases for Backwards Compatibility ─────────────────────────────────

export type JobCategoryValue = 
  | "Hospitality"
  | "Events"
  | "Delivery"
  | "Retail"
  | "Construction"
  | "Warehouse"
  | "Cleaning"
  | "Other";

export type JobTypeValue = "one-time" | "multiple-days" | "recurring";

export type JobStatusValue = "Open" | "PartiallyFilled" | "FullyFilled" | "Completed" | "Cancelled";

// ─── Location Types ───────────────────────────────────────────────────────────

/**
 * Structured location object for jobs.
 * Provides detailed location information for better matching and display.
 */
export interface JobLocation {
  /** Name of the venue/establishment (e.g., "Grand Palm Banquets") */
  venueName: string;
  
  /** Full street address */
  fullAddress: string;
  
  /** Area/neighborhood (e.g., "Andheri East") */
  area: string;
  
  /** City name (e.g., "Mumbai") */
  city: string;
  
  /** Nearby landmark for easier navigation (optional) */
  landmark?: string | undefined;
  
  /** GPS coordinates for map integration (optional) */
  mapCoordinates?: {
    latitude: number;
    longitude: number;
  } | undefined;
}

/**
 * Legacy location format - simple string.
 * Maintained for backward compatibility with existing data.
 */
export type LegacyLocation = string;

/**
 * Union type supporting both old and new location formats.
 */
export type JobLocationValue = JobLocation | LegacyLocation;

// ─── Requirements Types ───────────────────────────────────────────────────────

/**
 * Job requirements for worker qualifications.
 */
export interface JobRequirements {
  /** Required experience level (e.g., "Entry level", "2+ years", "Experienced") */
  experience?: string | undefined;
  
  /** Required skills (e.g., ["Food handling", "Customer service"]) */
  skills?: string[] | undefined;
  
  /** Age requirement (e.g., "18+", "21-50", "No restriction") */
  ageRequirement?: string | undefined;
  
  /** Required languages (e.g., ["English", "Hindi", "Marathi"]) */
  languages?: string[] | undefined;
  
  /** Dress code requirements (e.g., "Formal black and white", "Provided uniform") */
  dressCode?: string | undefined;
  
  /** Required documents (e.g., ["Government ID", "Bank details", "Police verification"]) */
  documentsRequired?: string[] | undefined;

  /** Category-specific notes or requirements */
  notes?: string | undefined;
}

/**
 * Job instructions for workers.
 */
export interface JobInstructions {
  /** Instructions before arriving at the venue */
  beforeArrival?: string[] | undefined;
  
  /** Instructions during the shift */
  duringShift?: string[] | undefined;
}

/**
 * Reporting contact information (private, only for confirmed workers).
 */
export interface ReportingContact {
  /** Contact person name */
  name: string;
  
  /** Contact method (e.g., "Phone", "WhatsApp", "On-site manager") */
  method: string;
  
  /** Where to report (e.g., "Main entrance", "Back office", "Security desk") */
  location: string;

  /** Contact phone number (optional) */
  phone?: string | undefined;
}

// ─── Core Job Interface ───────────────────────────────────────────────────────

export interface BaseJob {
  id: string;
  employerId: string;
  
  // New required fields
  jobTitle: string;
  category: JobCategoryValue;
  description: string;
  
  // Location (structured or legacy string)
  location: JobLocationValue;
  
  // Timing fields
  date: string; // ISO date string
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  duration?: number | undefined; // Calculated duration in minutes
  
  // Job type
  jobType: JobTypeValue;
  
  // Position tracking
  positionsRequired: number; // Total positions needed
  positionsConfirmed: number; // Positions filled
  positionsRemaining: number; // Calculated: positionsRequired - positionsConfirmed
  
  // Job status (auto-updated based on positions and date)
  status: JobStatusValue;
  
  // Compensation & facilities
  wage: number; // Base wage in rupees
  facilities?: string[] | undefined; // e.g., ["Meals provided", "Transport", "Uniform"]
  
  // Rapid Jobs
  isRapidJob: boolean; // True if this is an urgent/rapid job
  rapidJobExpiresAt?: string | undefined; // ISO timestamp - when rapid job expires (1-2 hours from posting)
  
  // Requirements, instructions, and reporting
  requirements?: JobRequirements | undefined;
  instructions?: JobInstructions | undefined;
  reportingContact?: ReportingContact | undefined; // Private: only visible to confirmed workers
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ─── Location Helper Functions ────────────────────────────────────────────────

/**
 * Type guard to check if location is structured JobLocation object.
 */
export function isStructuredLocation(location: JobLocationValue): location is JobLocation {
  return typeof location === 'object' && location !== null && 'venueName' in location;
}

/**
 * Get the area from location (works with both formats).
 */
export function getLocationArea(location: JobLocationValue): string {
  if (isStructuredLocation(location)) {
    return location.area;
  }
  // Legacy format: extract area from string (usually first part before comma)
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}

/**
 * Get the city from location (works with both formats).
 */
export function getLocationCity(location: JobLocationValue): string {
  if (isStructuredLocation(location)) {
    return location.city;
  }
  // Legacy format: extract city from string (usually last part after comma)
  const parts = location.split(',');
  return parts[parts.length - 1]?.trim() || location;
}

/**
 * Get a display-friendly location string (works with both formats).
 * @param format - 'short' (area only), 'medium' (area, city), 'full' (all details)
 */
export function formatLocation(
  location: JobLocationValue,
  format: 'short' | 'medium' | 'full' = 'medium'
): string {
  if (isStructuredLocation(location)) {
    switch (format) {
      case 'short':
        return location.area;
      case 'medium':
        return `${location.area}, ${location.city}`;
      case 'full':
        return location.landmark
          ? `${location.venueName}, ${location.fullAddress}, ${location.area}, ${location.city} (Near ${location.landmark})`
          : `${location.venueName}, ${location.fullAddress}, ${location.area}, ${location.city}`;
    }
  }
  // Legacy format: return as-is
  return location;
}

/**
 * Get the venue name from location (works with both formats).
 */
export function getVenueName(location: JobLocationValue): string | null {
  if (isStructuredLocation(location)) {
    return location.venueName;
  }
  // Legacy format: no venue name available
  return null;
}

/**
 * Get the full address from location (works with both formats).
 */
export function getFullAddress(location: JobLocationValue): string {
  if (isStructuredLocation(location)) {
    return location.fullAddress;
  }
  // Legacy format: the entire string is the "address"
  return location;
}

/**
 * Get map coordinates from location if available.
 */
export function getMapCoordinates(location: JobLocationValue): { latitude: number; longitude: number } | null {
  if (isStructuredLocation(location) && location.mapCoordinates) {
    return location.mapCoordinates;
  }
  return null;
}

/**
 * Convert legacy location string to structured JobLocation.
 * Attempts to parse the string format "Area, City" into structured components.
 */
export function migrateLocationToStructured(
  legacyLocation: string,
  options?: {
    venueName?: string;
    fullAddress?: string;
    landmark?: string;
  }
): JobLocation {
  const parts = legacyLocation.split(',').map(s => s.trim());
  
  return {
    venueName: options?.venueName || 'Unknown Venue',
    fullAddress: options?.fullAddress || legacyLocation,
    area: parts[0] || legacyLocation,
    city: parts[parts.length - 1] || 'Unknown City',
    landmark: options?.landmark,
  };
}

// ─── Duration Helper Functions ────────────────────────────────────────────────

/**
 * Calculate duration in minutes from startTime and endTime.
 * @param startTime - Time in HH:mm format (e.g., "09:00")
 * @param endTime - Time in HH:mm format (e.g., "17:30")
 * @returns Duration in minutes
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');
  
  const startHour = Number(startParts[0]);
  const startMin = Number(startParts[1]);
  const endHour = Number(endParts[0]);
  const endMin = Number(endParts[1]);
  
  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  
  // Handle overnight shifts (end time is next day)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours in minutes
  }
  
  return endMinutes - startMinutes;
}

/**
 * Format duration in minutes to human-readable string.
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "8h 30m", "2h")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

// ─── Validation Functions ─────────────────────────────────────────────────────

/**
 * Validate job category value.
 */
export function isValidJobCategory(value: string): value is JobCategoryValue {
  return Object.values(JobCategory).includes(value as JobCategory);
}

/**
 * Validate job type value.
 */
export function isValidJobType(value: string): value is JobTypeValue {
  return Object.values(JobType).includes(value as JobType);
}

/**
 * Validate job status value.
 */
export function isValidJobStatus(value: string): value is JobStatusValue {
  return Object.values(JobStatus).includes(value as JobStatus);
}

// ─── Position & Status Helper Functions ───────────────────────────────────────

/**
 * Calculate positions remaining.
 * @param positionsRequired - Total positions needed
 * @param positionsConfirmed - Positions already filled
 * @returns Number of positions still open
 */
export function calculatePositionsRemaining(
  positionsRequired: number,
  positionsConfirmed: number
): number {
  return Math.max(0, positionsRequired - positionsConfirmed);
}

/**
 * Auto-determine job status based on positions and date.
 * @param positionsRequired - Total positions needed
 * @param positionsConfirmed - Positions filled
 * @param jobDate - Job date (ISO string)
 * @param currentStatus - Current status (optional, for manual override)
 * @returns Calculated job status
 */
export function calculateJobStatus(
  positionsRequired: number,
  positionsConfirmed: number,
  jobDate: string,
  currentStatus?: JobStatusValue
): JobStatusValue {
  // If manually cancelled, keep that status
  if (currentStatus === JobStatus.Cancelled) {
    return JobStatus.Cancelled;
  }
  
  const jobDateTime = new Date(jobDate).getTime();
  const now = Date.now();
  
  // Check if job date has passed
  const jobEndOfDay = new Date(jobDate);
  jobEndOfDay.setHours(23, 59, 59, 999);
  
  if (now > jobEndOfDay.getTime()) {
    return JobStatus.Completed;
  }
  
  // Check position fill status
  const positionsRemaining = calculatePositionsRemaining(positionsRequired, positionsConfirmed);
  
  if (positionsConfirmed === 0) {
    return JobStatus.Open;
  }
  
  if (positionsRemaining === 0) {
    return JobStatus.FullyFilled;
  }
  
  // Partially filled
  return JobStatus.PartiallyFilled;
}

/**
 * Check if job is still accepting applications.
 * @param status - Current job status
 * @returns true if job can accept new applications
 */
export function canAcceptApplications(status: JobStatusValue): boolean {
  return status === JobStatus.Open || status === JobStatus.PartiallyFilled;
}

/**
 * Get fill percentage for a job.
 * @param positionsRequired - Total positions needed
 * @param positionsConfirmed - Positions filled
 * @returns Percentage filled (0-100)
 */
export function getFillPercentage(
  positionsRequired: number,
  positionsConfirmed: number
): number {
  if (positionsRequired === 0) return 0;
  return Math.round((positionsConfirmed / positionsRequired) * 100);
}

// ─── Category Display Names ───────────────────────────────────────────────────

export const JOB_CATEGORY_LABELS: Record<JobCategoryValue, string> = {
  Hospitality: "Hospitality",
  Events: "Events",
  Delivery: "Delivery",
  Retail: "Retail",
  Construction: "Construction",
  Warehouse: "Warehouse",
  Cleaning: "Cleaning",
  Other: "Other",
};

export const JOB_TYPE_LABELS: Record<JobTypeValue, string> = {
  "one-time": "One-time",
  "multiple-days": "Multiple Days",
  "recurring": "Recurring",
};

export const JOB_STATUS_LABELS: Record<JobStatusValue, string> = {
  Open: "Open",
  PartiallyFilled: "Partially Filled",
  FullyFilled: "Fully Filled",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const JOB_STATUS_COLORS: Record<JobStatusValue, { bg: string; text: string; border: string }> = {
  Open: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/40" },
  PartiallyFilled: { bg: "bg-gold/10", text: "text-gold-foreground dark:text-gold", border: "border-gold/40" },
  FullyFilled: { bg: "bg-success/10", text: "text-success", border: "border-success/40" },
  Completed: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  Cancelled: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/40" },
};

// ─── Legacy Type Support ──────────────────────────────────────────────────────

/**
 * Simplified job listing type for browse/search pages.
 * Used in work.tsx and similar listing views.
 */
export interface JobListing {
  id: string;
  jobTitle: string;
  category: JobCategoryValue;
  employer: string;
  rating?: string | undefined;
  wage: number;
  wageDisplay: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  location: string; // Display string
  area: string;
  distance?: string | undefined;
  facilities?: string[] | undefined;
  jobType: JobTypeValue;
  description?: string | undefined;
}

/**
 * Convert BaseJob to JobListing for display purposes.
 * Handles both structured and legacy location formats.
 */
export function toJobListing(
  job: BaseJob,
  options?: {
    employerName?: string;
    rating?: string;
    distance?: string;
  }
): JobListing {
  const duration = job.duration ?? calculateDuration(job.startTime, job.endTime);
  const area = getLocationArea(job.location);
  const locationDisplay = formatLocation(job.location, 'medium');
  
  return {
    id: job.id,
    jobTitle: job.jobTitle,
    category: job.category,
    employer: options?.employerName ?? "Unknown Employer",
    rating: options?.rating,
    wage: job.wage,
    wageDisplay: `₹${job.wage.toLocaleString()}`,
    date: job.date,
    startTime: job.startTime,
    endTime: job.endTime,
    duration,
    location: locationDisplay,
    area,
    distance: options?.distance,
    facilities: job.facilities,
    jobType: job.jobType,
    description: job.description,
  };
}

// ─── Rapid Job Helper Functions ───────────────────────────────────────────────

/**
 * Calculate rapid job expiration timestamp.
 * Rapid jobs expire 1-2 hours from posting time.
 * @param hoursUntilExpiry - Hours until expiry (default: 2)
 * @returns ISO timestamp string
 */
export function calculateRapidJobExpiry(hoursUntilExpiry: number = 2): string {
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + hoursUntilExpiry);
  return expiryTime.toISOString();
}

/**
 * Check if a rapid job has expired.
 * @param rapidJobExpiresAt - ISO timestamp of expiration
 * @returns true if expired
 */
export function isRapidJobExpired(rapidJobExpiresAt?: string): boolean {
  if (!rapidJobExpiresAt) return false;
  return new Date(rapidJobExpiresAt).getTime() < Date.now();
}

/**
 * Get time remaining until rapid job expires.
 * @param rapidJobExpiresAt - ISO timestamp of expiration
 * @returns Minutes remaining, or 0 if expired/null
 */
export function getRapidJobTimeRemaining(rapidJobExpiresAt?: string): number {
  if (!rapidJobExpiresAt) return 0;
  
  const expiryTime = new Date(rapidJobExpiresAt).getTime();
  const now = Date.now();
  
  if (now >= expiryTime) return 0;
  
  return Math.ceil((expiryTime - now) / (1000 * 60)); // Convert to minutes
}

/**
 * Format rapid job time remaining for display.
 * @param rapidJobExpiresAt - ISO timestamp of expiration
 * @returns Formatted string like "45 min", "1h 20m", or "Expired"
 */
export function formatRapidJobTimeRemaining(rapidJobExpiresAt?: string): string {
  const minutesRemaining = getRapidJobTimeRemaining(rapidJobExpiresAt);
  
  if (minutesRemaining === 0) return 'Expired';
  
  if (minutesRemaining < 60) {
    return `${minutesRemaining} min`;
  }
  
  const hours = Math.floor(minutesRemaining / 60);
  const mins = minutesRemaining % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Check if a rapid job should be hidden/expired.
 * A rapid job should be hidden if:
 * - It has expired (past rapidJobExpiresAt)
 * - It is fully filled
 * @param job - The job to check
 * @returns true if job should be hidden
 */
export function shouldHideRapidJob(job: BaseJob): boolean {
  if (!job.isRapidJob) return false;
  
  // Hide if expired
  if (isRapidJobExpired(job.rapidJobExpiresAt)) {
    return true;
  }
  
  // Hide if fully filled
  if (job.status === JobStatus.FullyFilled) {
    return true;
  }
  
  return false;
}

/**
 * Update rapid job status based on expiry and fill status.
 * Should be called by scheduled check.
 * @param job - The job to check
 * @returns Updated status if changed, null if no change needed
 */
export function updateRapidJobStatus(job: BaseJob): {
  shouldHide: boolean;
  newStatus?: JobStatusValue;
  reason: string;
} | null {
  if (!job.isRapidJob) return null;
  
  // Check if expired
  if (isRapidJobExpired(job.rapidJobExpiresAt)) {
    return {
      shouldHide: true,
      newStatus: job.status === JobStatus.Open ? JobStatus.Cancelled : job.status,
      reason: 'Rapid job expired',
    };
  }
  
  // Check if fully filled
  if (job.status === JobStatus.FullyFilled) {
    return {
      shouldHide: true,
      reason: 'Rapid job fully filled',
    };
  }
  
  return null;
}

/**
 * Get all rapid jobs that need status updates.
 * Use this in a scheduled job to check for expired/filled rapid jobs.
 * @param jobs - Array of jobs to check
 * @returns Array of job IDs that need updates with their new status
 */
export function getRapidJobsNeedingUpdate(jobs: BaseJob[]): Array<{
  jobId: string;
  shouldHide: boolean;
  newStatus?: JobStatusValue;
  reason: string;
}> {
  const updates: Array<{
    jobId: string;
    shouldHide: boolean;
    newStatus?: JobStatusValue;
    reason: string;
  }> = [];
  
  jobs.forEach(job => {
    const update = updateRapidJobStatus(job);
    if (update) {
      updates.push({
        jobId: job.id,
        ...update,
      });
    }
  });
  
  return updates;
}

/**
 * Filter out expired/hidden rapid jobs from a list.
 * @param jobs - Array of jobs
 * @returns Filtered array with hidden rapid jobs removed
 */
export function filterVisibleRapidJobs(jobs: BaseJob[]): BaseJob[] {
  return jobs.filter(job => {
    if (!job.isRapidJob) return true; // Keep non-rapid jobs
    return !shouldHideRapidJob(job); // Only keep visible rapid jobs
  });
}
