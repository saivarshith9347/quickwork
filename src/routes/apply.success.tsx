/**
 * /apply/success — Application Submitted (Success Screen)
 *
 * Step 3 of 3 in the Position Selection → Review → Success flow.
 *
 * Reads confirmed booking from sessionStorage (set by the review page).
 *
 * Animations (pure CSS — zero Framer Motion):
 *   - ring-pop: outer success ring scales in from 70% → 100%
 *   - check-draw: SVG checkmark strokes in via stroke-dashoffset
 *   - ring-pulse: ambient breathing glow after pop
 *   - fade-up: content blocks stagger up sequentially
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Clock,
  IndianRupee,
  ListChecks,
  MapPin,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/apply/success")({
  head: () => ({
    meta: [
      { title: "Application Submitted — QuickWork" },
      {
        name: "description",
        content: "Your work position application has been submitted successfully.",
      },
    ],
  }),
  component: SuccessPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmedBooking {
  applicationId: string;
  positionId: string;
  categoryName: string;
  positionNumber: number;
  wage: number;
  jobId: string;
  jobTitle: string;
  jobDate?: string;
  startTime?: string;
  endTime?: string;
  area?: string;
  venueName?: string;
  isRapidJob?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const dh = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  return `${dh}:${String(m!).padStart(2, "0")} ${suffix}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

function posLabel(n: number): string {
  return String(n).padStart(2, "0");
}

// ─── Animated checkmark SVG ───────────────────────────────────────────────────

function AnimatedCheck({ triggered }: { triggered: boolean }) {
  return (
    <svg
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="size-12"
    >
      <polyline
        points="12,27 22,37 40,18"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset={triggered ? 0 : 60}
        style={{
          transition: triggered
            ? "stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s, opacity 0.3s ease 0.25s"
            : "none",
          opacity: triggered ? 1 : 0,
        }}
      />
    </svg>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-border/60 py-3.5 last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <Icon className="size-4 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SuccessPage() {
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [checkTriggered, setCheckTriggered] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const raw = sessionStorage.getItem("qw_confirmed_booking");
    if (raw) {
      try {
        setBooking(JSON.parse(raw) as ConfirmedBooking);
      } catch {
        /* ignore */
      }
    }

    // Sequence: ring pops → check draws → content fades up
    const t1 = setTimeout(() => setCheckTriggered(true), 300);
    const t2 = setTimeout(() => setContentVisible(true), 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // ── Fallback mock for preview mode ───────────────────────────────────────
  const b: ConfirmedBooking =
    booking ??
    ({
      applicationId: "preview-app-id",
      positionId: "preview-pos-id",
      categoryName: "Food Serving",
      positionNumber: 3,
      wage: 1200,
      jobId: "preview-job",
      jobTitle: "Wedding Event Staff",
      jobDate: new Date().toISOString().split("T")[0],
      startTime: "19:00",
      endTime: "23:00",
      area: "Gachibowli",
      venueName: "Grand Sapphire Banquets",
      isRapidJob: false,
    } as ConfirmedBooking);

  const posNum = posLabel(b.positionNumber);
  const appId =
    b.applicationId !== "preview-app-id"
      ? `QW-${b.applicationId.replace(/-/g, "").substring(0, 8).toUpperCase()}`
      : "QW-PREVIEW";

  return (
    <div className="mx-auto max-w-2xl min-h-screen px-5 pb-16 pt-12 lg:px-8">
      {/* ── Success icon ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center">
        {/* Ring + check */}
        <div
          className="relative flex size-28 items-center justify-center rounded-full text-success"
          style={{
            animation: "ring-pop 0.55s cubic-bezier(0.22,1.2,0.36,1) 0.1s both",
            backgroundColor: "color-mix(in oklab, var(--success) 10%, transparent)",
            border: "2.5px solid color-mix(in oklab, var(--success) 30%, transparent)",
            boxShadow: checkTriggered
              ? "0 0 0 0 color-mix(in oklab, var(--success) 0%, transparent)"
              : undefined,
            animationName: checkTriggered ? "ring-pop, ring-pulse" : "ring-pop",
            animationDuration: checkTriggered ? "0.55s, 2.8s" : "0.55s",
            animationDelay: checkTriggered ? "0.1s, 0.85s" : "0.1s",
            animationTimingFunction: checkTriggered
              ? "cubic-bezier(0.22,1.2,0.36,1), ease-in-out"
              : "cubic-bezier(0.22,1.2,0.36,1)",
            animationIterationCount: checkTriggered ? "1, infinite" : "1",
            animationFillMode: "both, none",
          }}
        >
          <AnimatedCheck triggered={checkTriggered} />
        </div>

        {/* Heading */}
        <div
          style={{
            animation: contentVisible ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both" : "none",
            opacity: contentVisible ? undefined : 0,
          }}
        >
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
            Application Submitted
          </h1>
          <p className="mt-2 text-base font-semibold text-primary">
            {b.categoryName} · Position {posNum}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{b.jobTitle}</p>
          {b.isRapidJob && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-600 dark:text-orange-400">
              <span className="inline-block size-2 rounded-full bg-orange-500 animate-pulse" />⚡
              Rapid Job Confirmed
            </div>
          )}
        </div>
      </div>

      {/* ── Details card ─────────────────────────────────────────────────── */}
      <div
        className="mt-8 rounded-3xl border border-border bg-card p-6"
        style={{
          animation: contentVisible ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 80ms both" : "none",
          opacity: contentVisible ? undefined : 0,
        }}
      >
        {b.jobDate && <InfoRow icon={CalendarDays} label="Date" value={formatDate(b.jobDate)} />}
        {b.startTime && b.endTime && (
          <InfoRow
            icon={Clock}
            label="Time"
            value={`${fmt12(b.startTime)} – ${fmt12(b.endTime)}`}
          />
        )}
        {b.area && (
          <InfoRow
            icon={MapPin}
            label="Location"
            value={b.venueName ? `${b.venueName}, ${b.area}` : b.area}
          />
        )}
        <InfoRow icon={Briefcase} label="Position" value={`${b.categoryName} · ${posNum}`} />
        <InfoRow
          icon={IndianRupee}
          label="Earnings"
          value={`₹${b.wage.toLocaleString("en-IN")} / shift`}
          accent
        />
      </div>

      {/* ── Application ID ────────────────────────────────────────────────── */}
      <div
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-5 py-4"
        style={{
          animation: contentVisible
            ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 160ms both"
            : "none",
          opacity: contentVisible ? undefined : 0,
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Application ID
          </p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{appId}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
          <ListChecks className="size-5" aria-hidden="true" />
        </div>
      </div>

      {/* ── What's next note ─────────────────────────────────────────────── */}
      <div
        className="mt-5 rounded-2xl border border-primary/25 bg-primary/[0.04] px-5 py-4 text-sm text-muted-foreground"
        style={{
          animation: contentVisible
            ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 220ms both"
            : "none",
          opacity: contentVisible ? undefined : 0,
        }}
      >
        <p className="font-semibold text-foreground">What happens next?</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
          <li>✓ Your position is confirmed and reserved</li>
          <li>✓ Report to the venue 30 minutes before shift start</li>
          <li>✓ Wage paid via UPI within 24 hours of completion</li>
        </ul>
      </div>

      {/* ── CTAs ─────────────────────────────────────────────────────────── */}
      <div
        className="mt-8 flex flex-col gap-3"
        style={{
          animation: contentVisible
            ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 300ms both"
            : "none",
          opacity: contentVisible ? undefined : 0,
        }}
      >
        <Button id="view-applications-btn" variant="hero" size="lg" className="w-full" asChild>
          <Link to="/my-applications">
            <ListChecks className="size-4" aria-hidden="true" />
            View My Applications
          </Link>
        </Button>

        <Button id="find-more-work-btn" variant="outline" size="lg" className="w-full" asChild>
          <Link to="/work">
            Find More Work
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {/* ── Ref note ─────────────────────────────────────────────────────── */}
      <p
        className="mt-6 text-center text-xs text-muted-foreground/60"
        style={{
          animation: contentVisible
            ? "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) 380ms both"
            : "none",
          opacity: contentVisible ? undefined : 0,
        }}
      >
        Save your reference:{" "}
        <span className="font-mono font-semibold text-muted-foreground">{appId}</span>
      </p>
    </div>
  );
}
