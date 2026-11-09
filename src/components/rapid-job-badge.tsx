import { Clock, MapPin, Users, Zap, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRapidJobCountdown, type RapidJobTimingInput } from "@/lib/rapid-job-countdown";
import { formatDistance, getDistanceToJob } from "@/lib/distance-utils";
import { Button } from "@/components/ui/button";

export interface RapidJobBadgeProps {
  jobDate?: string;
  startTime?: string;
  endTime?: string;
  rapidJobExpiresAt?: string | null;
  onCutoff?: () => void;
  variant?: "default" | "compact" | "large";
  showIcon?: boolean;
  showCountdown?: boolean;
  className?: string;
}

/**
 * RapidJobBadge
 * Displays the urgent RAPID JOB badge with live countdown calculated from actual job start time.
 * Uses subtle localized badge pulse and countdown transition without flashing the page.
 */
export function RapidJobBadge({
  jobDate = new Date().toISOString().split("T")[0]!,
  startTime = "19:00",
  endTime,
  rapidJobExpiresAt,
  onCutoff,
  variant = "default",
  showIcon = true,
  showCountdown = true,
  className = "",
}: RapidJobBadgeProps) {
  const countdown = useRapidJobCountdown(
    {
      jobDate,
      startTime,
      ...(endTime !== undefined && { endTime }),
      ...(rapidJobExpiresAt !== undefined && { rapidJobExpiresAt }),
      isRapidJob: true,
    },
    onCutoff,
  );

  const { isCutoffReached, formattedTime, urgencyLevel, seconds } = countdown;

  // Variant size tokens
  const variantStyles = {
    compact: "px-2.5 py-0.5 text-[11px]",
    default: "px-3 py-1 text-xs",
    large: "px-3.5 py-1.5 text-sm",
  };

  const iconSizes = {
    compact: "size-3",
    default: "size-3.5",
    large: "size-4",
  };

  if (isCutoffReached) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/30 bg-muted/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground ${className}`}
        role="status"
        aria-label="Applications closed. Shift cutoff reached."
      >
        <Clock className={iconSizes[variant]} aria-hidden="true" />
        <span>Applications Closed</span>
      </span>
    );
  }

  // Theme according to urgency level (subtle micro-styling, no harsh page effects)
  const urgencyTheme =
    urgencyLevel === "critical"
      ? "border-destructive/60 bg-destructive/15 text-destructive dark:text-red-400"
      : urgencyLevel === "urgent"
        ? "border-orange-500/60 bg-orange-500/15 text-orange-600 dark:text-orange-400"
        : "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400";

  return (
    <span
      className={`relative inline-flex items-center rounded-full font-semibold ${urgencyTheme} ${variantStyles[variant]} ${className}`}
      role="timer"
      aria-live="polite"
      aria-label={`Rapid Job starts in ${formattedTime}`}
    >
      {/* Subtle localized badge pulse animation (ring halo only) */}
      <span className="absolute inset-0 rounded-full animate-rapid-badge pointer-events-none" />

      {/* Badge contents */}
      <span className="relative flex items-center gap-1.5">
        {showIcon && (
          <Zap
            className={`${iconSizes[variant]} fill-current transition-transform duration-300`}
            aria-hidden="true"
          />
        )}
        <span className="uppercase tracking-wider font-bold">Rapid Job</span>

        {showCountdown && (
          <>
            <span className="opacity-50" aria-hidden="true">
              ·
            </span>
            <Clock className={`${iconSizes[variant]} opacity-80`} aria-hidden="true" />
            <span
              key={seconds}
              className="font-mono tabular-nums font-bold tracking-tight animate-countdown-tick"
            >
              {formattedTime}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * Dedicated Countdown display block (matching the prompt's layout:
 * Starts in:
 * 47:32
 */
export function RapidJobCountdownBlock({
  jobDate,
  startTime,
  rapidJobExpiresAt,
  onCutoff,
  className = "",
}: {
  jobDate: string;
  startTime: string;
  rapidJobExpiresAt?: string | null;
  onCutoff?: () => void;
  className?: string;
}) {
  const countdown = useRapidJobCountdown(
    {
      jobDate,
      startTime,
      ...(rapidJobExpiresAt !== undefined && { rapidJobExpiresAt }),
      isRapidJob: true,
    },
    onCutoff,
  );

  const { isCutoffReached, formattedTime, urgencyLevel, seconds } = countdown;

  if (isCutoffReached) {
    return (
      <div className={`rounded-xl border border-muted bg-muted/40 p-3 text-center ${className}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Shift Status
        </p>
        <p className="mt-1 font-display text-sm font-bold text-muted-foreground">
          Cutoff Reached · Applications Closed
        </p>
      </div>
    );
  }

  const isUrgent = urgencyLevel === "critical" || urgencyLevel === "urgent";

  return (
    <div
      className={`rounded-xl border p-3.5 transition-colors ${
        isUrgent
          ? "border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-transparent"
          : "border-border bg-card/60"
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="size-3.5 text-orange-500" aria-hidden="true" />
          Starts in:
        </p>
        {isUrgent && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            Immediate start
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <p
          key={seconds}
          className={`font-mono text-3xl font-extrabold tracking-tight tabular-nums animate-countdown-tick ${
            urgencyLevel === "critical"
              ? "text-destructive dark:text-red-400"
              : "text-orange-600 dark:text-orange-400"
          }`}
        >
          {formattedTime}
        </p>
        <span className="text-xs font-medium text-muted-foreground">before shift starts</span>
      </div>
    </div>
  );
}

/**
 * RapidJobSpotlightCard
 * Prominent card showcasing a Rapid Job in Find Work with:
 * - ⚡ Rapid badge
 * - countdown
 * - availability ("3 workers required")
 * - wage
 * - distance
 */
export interface RapidJobSpotlightCardProps {
  id: string;
  jobTitle: string;
  category: string;
  venueName: string;
  area: string;
  city: string;
  jobDate: string;
  startTime: string;
  endTime: string;
  wage: number;
  availablePositions: number;
  totalPositions: number;
  rapidJobExpiresAt?: string | null;
  distance?: string | null;
}

export function RapidJobSpotlightCard({
  id,
  jobTitle,
  category,
  venueName,
  area,
  city,
  jobDate,
  startTime,
  endTime,
  wage,
  availablePositions,
  totalPositions,
  rapidJobExpiresAt,
  distance,
}: RapidJobSpotlightCardProps) {
  const [isCutoff, setIsCutoff] = useState(false);

  const countdown = useRapidJobCountdown(
    {
      jobDate,
      startTime,
      ...(endTime !== undefined && { endTime }),
      ...(rapidJobExpiresAt !== undefined && { rapidJobExpiresAt }),
      isRapidJob: true,
    },
    () => setIsCutoff(true),
  );

  const calculatedDistance = distance ?? getDistanceToJob(area).distanceDisplay ?? "Nearby";

  const isFull = availablePositions === 0 && totalPositions > 0;
  const isClosed = isCutoff || countdown.isCutoffReached;

  // Percentage filled
  const fillPct =
    totalPositions > 0 ? Math.max(8, Math.round((availablePositions / totalPositions) * 100)) : 0;

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        isClosed || isFull
          ? "border-border bg-card/60 opacity-60"
          : "border-orange-500/50 bg-gradient-to-br from-orange-500/[0.08] via-card to-card shadow-[0_4px_24px_rgba(249,115,22,0.12)] hover:border-orange-500 hover:shadow-[0_8px_32px_rgba(249,115,22,0.22)] hover:-translate-y-1"
      }`}
    >
      {/* Top accent gradient bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* Top row: Rapid Badge & Live Countdown */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <RapidJobBadge
            jobDate={jobDate}
            startTime={startTime}
            rapidJobExpiresAt={rapidJobExpiresAt ?? null}
            variant="compact"
            onCutoff={() => setIsCutoff(true)}
          />

          {/* Location & Distance badge */}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
            <MapPin className="size-3 text-orange-500" aria-hidden="true" />
            <span>{area}</span>
            {calculatedDistance && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-foreground">{calculatedDistance}</span>
              </>
            )}
          </span>
        </div>

        {/* Job Title */}
        <div className="mt-1">
          <Link
            to="/work/$jobId"
            params={{ jobId: id }}
            className="group/link focus-visible:outline-none"
          >
            <h3 className="font-display text-lg sm:text-xl font-bold text-foreground leading-snug group-hover/link:text-orange-600 dark:group-hover/link:text-orange-400 transition-colors">
              {jobTitle}
            </h3>
          </Link>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {venueName} · {city}
          </p>
        </div>

        {/* Availability: e.g. "3 workers required" */}
        <div className="mt-4 rounded-xl border border-border/70 bg-surface/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Users className="size-3.5 text-orange-500" aria-hidden="true" />
              {isClosed ? (
                <span className="text-muted-foreground">Cutoff reached</span>
              ) : isFull ? (
                <span className="text-muted-foreground">All positions filled</span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">
                  {availablePositions} worker{availablePositions !== 1 ? "s" : ""} required
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {availablePositions} / {totalPositions} open
            </span>
          </div>

          {/* Smooth availability update bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isClosed || isFull
                  ? "bg-muted-foreground/30"
                  : availablePositions <= 3
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 animate-availability-urgent"
                    : "bg-gradient-to-r from-orange-500 to-orange-400"
              }`}
              style={{ width: `${fillPct}%` }}
              role="progressbar"
              aria-valuenow={availablePositions}
              aria-valuemax={totalPositions}
              aria-label={`${availablePositions} of ${totalPositions} workers required`}
            />
          </div>
        </div>

        {/* Countdown & Wage Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Starts in Countdown */}
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.05] p-3 flex flex-col justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="size-3 text-orange-500" aria-hidden="true" />
              Starts in:
            </span>
            <span
              key={countdown.seconds}
              className={`mt-1 font-mono text-xl sm:text-2xl font-extrabold tabular-nums animate-countdown-tick ${
                countdown.urgencyLevel === "critical"
                  ? "text-destructive"
                  : "text-orange-600 dark:text-orange-400"
              }`}
            >
              {isClosed ? "Closed" : countdown.formattedTime}
            </span>
          </div>

          {/* Wage */}
          <div className="rounded-xl border border-border bg-surface/80 p-3 flex flex-col justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Wage:
            </span>
            <span className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-foreground">
              ₹{wage.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ shift</span>
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-5 pt-1">
          {isClosed ? (
            <Button
              variant="outline"
              disabled
              className="w-full font-semibold opacity-60 cursor-not-allowed"
            >
              Applications Closed
            </Button>
          ) : isFull ? (
            <Button
              variant="outline"
              disabled
              className="w-full font-semibold opacity-60 cursor-not-allowed"
            >
              Positions Filled
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="w-full font-bold bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-[0_4px_16px_rgba(249,115,22,0.3)] transition-all duration-200 active:scale-[0.98]"
            >
              <Link to="/work/$jobId/positions" params={{ jobId: id }}>
                <Zap className="size-4 fill-current mr-1.5" aria-hidden="true" />
                Select Position — Urgent
                <ArrowRight
                  className="size-4 ml-1 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Surge pricing indicator
 */
export function SurgePricingBadge({
  surgePercentage = 20,
  className = "",
}: {
  surgePercentage?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success ${className}`}
    >
      <Zap className="size-3 fill-current" />+{surgePercentage}% surge
    </span>
  );
}
