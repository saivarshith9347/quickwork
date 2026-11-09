/**
 * Rapid Job Countdown & Cutoff Engine.
 *
 * Requirements:
 * - The countdown must be calculated from the actual job start/end time.
 * - Do not use a fake static countdown.
 * - When countdown reaches the relevant cutoff: stop accepting applications.
 * - Displays in format like "47:32" (MM:SS) or "01:47:32" (HH:MM:SS).
 */

import { useEffect, useState, useMemo, useCallback } from "react";

export interface RapidJobTimingInput {
  jobDate: string; // YYYY-MM-DD or ISO
  startTime: string; // HH:MM or HH:MM:SS
  endTime?: string; // HH:MM or HH:MM:SS
  rapidJobExpiresAt?: string | null;
  isRapidJob?: boolean;
}

export interface RapidJobCountdownState {
  remainingMs: number;
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTime: string; // e.g. "47:32" or "01:25:10"
  isExpired: boolean;
  isCutoffReached: boolean;
  urgencyLevel: "normal" | "urgent" | "critical" | "expired";
  cutoffTimestamp: number;
}

/**
 * Parses jobDate and startTime into an exact Date object
 */
export function getShiftStartDateTime(jobDate: string, startTime: string): Date {
  if (!jobDate) return new Date();

  // Strip timezone if present to parse cleanly with local date
  const cleanDate = jobDate.includes("T") ? jobDate.split("T")[0]! : jobDate;
  const [hStr, mStr] = (startTime || "00:00").split(":");
  const h = parseInt(hStr || "0", 10);
  const m = parseInt(mStr || "0", 10);

  const [year, month, day] = cleanDate.split("-").map((v) => parseInt(v, 10));
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day, h, m, 0, 0);
}

/**
 * Calculates the exact cutoff timestamp for a rapid job.
 * For rapid jobs, applications close when:
 * 1. An explicit rapidJobExpiresAt timestamp is reached (e.g. 1-2 hours posting window), OR
 * 2. The job shift start time is reached (workers needed before shift starts).
 * Whichever comes first is the operative cutoff time.
 */
export function getRapidJobCutoffTimestamp(input: RapidJobTimingInput): number {
  const shiftStart = getShiftStartDateTime(input.jobDate, input.startTime).getTime();

  if (input.rapidJobExpiresAt) {
    const expiresAt = new Date(input.rapidJobExpiresAt).getTime();
    if (!isNaN(expiresAt)) {
      // If expiresAt is set, it might be the expiration window
      return Math.min(shiftStart, expiresAt);
    }
  }

  return shiftStart;
}

/**
 * Calculates current countdown state from cutoff timestamp
 */
export function calculateCountdownState(cutoffTimestamp: number): RapidJobCountdownState {
  const now = Date.now();
  const remainingMs = Math.max(0, cutoffTimestamp - now);
  const totalSeconds = Math.floor(remainingMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isCutoffReached = remainingMs <= 0;
  const isExpired = isCutoffReached;

  let urgencyLevel: RapidJobCountdownState["urgencyLevel"] = "normal";
  if (isCutoffReached) {
    urgencyLevel = "expired";
  } else if (totalSeconds <= 15 * 60) {
    // Under 15 minutes: critical
    urgencyLevel = "critical";
  } else if (totalSeconds <= 30 * 60) {
    // Under 30 minutes: urgent
    urgencyLevel = "urgent";
  }

  // Format matching specification:
  // e.g. "47:32" if under 1 hour, "01:47:32" if 1 hour or more
  let formattedTime = "";
  if (isCutoffReached) {
    formattedTime = "00:00";
  } else if (hours > 0) {
    formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  } else {
    formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return {
    remainingMs,
    totalSeconds,
    hours,
    minutes,
    seconds,
    formattedTime,
    isExpired,
    isCutoffReached,
    urgencyLevel,
    cutoffTimestamp,
  };
}

/**
 * React hook for live second-by-second rapid job countdown.
 * Automatically recalculates every 1 second and triggers onCutoff when cutoff is reached.
 */
export function useRapidJobCountdown(
  timing: RapidJobTimingInput,
  onCutoff?: () => void,
): RapidJobCountdownState {
  const cutoffTimestamp = useMemo(
    () => getRapidJobCutoffTimestamp(timing),
    [timing.jobDate, timing.startTime, timing.rapidJobExpiresAt],
  );

  const [state, setState] = useState<RapidJobCountdownState>(() =>
    calculateCountdownState(cutoffTimestamp),
  );

  useEffect(() => {
    // Initial update
    const initial = calculateCountdownState(cutoffTimestamp);
    setState(initial);

    if (initial.isCutoffReached) {
      onCutoff?.();
      return;
    }

    const interval = setInterval(() => {
      const next = calculateCountdownState(cutoffTimestamp);
      setState(next);

      if (next.isCutoffReached) {
        clearInterval(interval);
        onCutoff?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cutoffTimestamp, onCutoff]);

  return state;
}
