/**
 * /apply/review — Application Review & Confirm
 *
 * Step 2 of 3 in the Position Selection → Review → Success flow.
 *
 * Reads the pending booking from sessionStorage (set by the positions page).
 * On "Confirm Application":
 *   1. Re-checks position availability from Supabase (never trusts stale state)
 *   2. Calls confirm_booking RPC atomically
 *   3. On success → /apply/success
 *   4. On failure → inline error with [Choose Another Position] CTA
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Bus,
  Shirt,
  Coffee,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { ApplicationService } from "@/lib/services/application-service";
import { broadcastPositionUpdate, subscribeToJobPositions } from "@/lib/position-service";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/apply/review")({
  head: () => ({
    meta: [
      { title: "Review Application — QuickWork" },
      {
        name: "description",
        content: "Review your work position selection before confirming your application.",
      },
    ],
  }),
  component: ReviewPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingBooking {
  positionId: string;
  categoryId: string;
  categoryName: string;
  positionNumber: number;
  wage: number;
  lockExpiresAt: string | null;
  jobId: string;
  jobTitle: string;
  jobDate?: string;
  startTime?: string;
  endTime?: string;
  area?: string;
  city?: string;
  venueName?: string;
  facilities?: string[];
  isRapidJob?: boolean;
  rapidJobExpiresAt?: string | null;
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
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function posLabel(n: number): string {
  return String(n).padStart(2, "0");
}

const FACILITY_ICONS: Record<string, typeof UtensilsCrossed> = {
  Meals: UtensilsCrossed,
  Meal: UtensilsCrossed,
  Transport: Bus,
  Uniform: Shirt,
  Snacks: Coffee,
};

const CONFIRM_BOOKING_ERRORS: Record<string, string> = {
  position_not_found:              "This position no longer exists.",
  position_already_booked:         "Position was booked by another worker just now.",
  no_active_lock:                  "Your hold on this position has expired. Please select again.",
  position_cancelled:              "This position has been cancelled by the employer.",
  position_unavailable:            "This position is no longer available.",
  lock_owned_by_different_worker:  "Another worker holds this position.",
  lock_expired:                    "Your 2-minute hold expired. Please select again.",
};

// ─── Lock countdown ───────────────────────────────────────────────────────────

function LockTimer({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secs]);

  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const isUrgent = secs > 0 && secs <= 30;
  const expired = secs === 0;

  return (
    <span
      className={`font-display font-bold tabular-nums ${
        expired
          ? "text-destructive"
          : isUrgent
            ? "text-destructive animate-pulse"
            : "text-primary"
      }`}
    >
      {expired ? "Expired" : `${mins}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border/60 py-4 last:border-b-0 ${className}`}
    >
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-right text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ReviewPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, openLoginModal } = useAuth();

  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isRapidCutoff, setIsRapidCutoff] = useState(false);
  const hasMounted = useRef(false);

  // ── Read sessionStorage ────────────────────────────────────────────────
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const raw = sessionStorage.getItem("qw_pending_booking");
    if (!raw) {
      setLoadError("No position selected. Please choose a position first.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PendingBooking;
      setBooking(parsed);

      // Eagerly enrich with job meta if missing fields
      if (!parsed.jobDate || !parsed.startTime) {
        enrichFromSupabase(parsed.jobId).then((meta) => {
          if (meta) setBooking((b) => b ? { ...b, ...meta } : b);
        });
      }
    } catch {
      setLoadError("Invalid booking data. Please start over.");
    }
  }, []);

  async function enrichFromSupabase(jobId: string): Promise<Partial<PendingBooking> | null> {
    try {
      const client = getSupabase();
      if (!client) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (client as any)
        .from("jobs")
        .select("job_date, start_time, end_time, area, city, venue_name, facilities, is_rapid_job")
        .eq("id", jobId)
        .single();
      if (!data) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return {
        jobDate: d.job_date,
        startTime: (d.start_time as string).slice(0, 5),
        endTime: (d.end_time as string).slice(0, 5),
        area: d.area,
        city: d.city,
        venueName: d.venue_name,
        facilities: (d.facilities as string[]) ?? [],
        isRapidJob: d.is_rapid_job,
      };
    } catch {
      return null;
    }
  }

  // ── Confirm ────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!booking) return;

    if (isRapidCutoff) {
      toast.error("Applications closed", {
        description: "The shift cutoff has passed for this Rapid Job.",
      });
      return;
    }

    const isMock = booking.jobId.startsWith("mock") || !getSupabase();
    if (isMock) {
      setConfirming(true);
      await new Promise((r) => setTimeout(r, 600));
      const applicationId = `app-mock-${Date.now()}`;
      sessionStorage.setItem(
        "qw_confirmed_booking",
        JSON.stringify({
          applicationId,
          positionId: booking.positionId,
          categoryName: booking.categoryName,
          positionNumber: booking.positionNumber,
          wage: booking.wage,
          jobId: booking.jobId,
          jobTitle: booking.jobTitle,
          jobDate: booking.jobDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          area: booking.area,
          venueName: booking.venueName,
          isRapidJob: booking.isRapidJob,
        }),
      );
      sessionStorage.removeItem("qw_pending_booking");
      // Broadcast booked status to other workers & tabs immediately
      broadcastPositionUpdate(booking.jobId, {
        id: booking.positionId,
        job_id: booking.jobId,
        status: "BOOKED",
        position_number: booking.positionNumber,
        category_id: booking.categoryId,
        worker_id: user?.id ?? "mock_worker",
      });

      setConfirming(false);
      void navigate({ to: "/apply/success" });
      return;
    }

    if (!isLoggedIn) {
      openLoginModal({ type: "book-shift", payload: booking.jobId });
      return;
    }

    if (!user?.id) {
      toast.error("Could not identify your account. Please sign in again.");
      return;
    }

    setConfirming(true);
    setConfirmError(null);
    setErrorCode(null);

    const result = await ApplicationService.confirmBooking({
      positionId: booking.positionId,
    });

    if (!result.success) {
      setConfirming(false);
      const code = result.error ?? "unknown";
      setErrorCode(code);
      setConfirmError(CONFIRM_BOOKING_ERRORS[code] ?? result.error ?? "This position is no longer available.");
      return;
    }

    // Broadcast booked status to other workers & tabs immediately
    broadcastPositionUpdate(booking.jobId, {
      id: booking.positionId,
      job_id: booking.jobId,
      status: "BOOKED",
      position_number: booking.positionNumber,
      category_id: booking.categoryId,
      worker_id: user.id,
    });

    // ✅ Success — store application ID and navigate
    const applicationId = result.applicationId;
    sessionStorage.setItem(
      "qw_confirmed_booking",
      JSON.stringify({
        applicationId,
        positionId: booking.positionId,
        categoryName: booking.categoryName,
        positionNumber: booking.positionNumber,
        wage: booking.wage,
        jobId: booking.jobId,
        jobTitle: booking.jobTitle,
        jobDate: booking.jobDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        area: booking.area,
        venueName: booking.venueName,
        isRapidJob: booking.isRapidJob,
      }),
    );
    sessionStorage.removeItem("qw_pending_booking");

    setConfirming(false);
    void navigate({ to: "/apply/success" });
  }

  // ── Realtime position sync on review page ──────────────────────────────
  useEffect(() => {
    if (!booking?.jobId || !booking?.positionNumber) return;
    const currentPosNum = booking.positionNumber;
    const currentPosId = booking.positionId;
    const currentCatId = booking.categoryId;
    const myWorkerId = user?.id ?? null;

    const sub = subscribeToJobPositions(booking.jobId, ({ newRow }) => {
      if (!newRow) return;
      const posNum = typeof newRow["position_number"] === "number" ? newRow["position_number"] : null;
      const catId = (newRow["category_id"] as string | null) ?? null;
      const newStatus = (newRow["status"] as string) || "";
      const newWorkerId = (newRow["worker_id"] as string | null) ?? null;

      const matchesPosition =
        (newRow["id"] && newRow["id"] === currentPosId) ||
        (posNum != null && posNum === currentPosNum && (!catId || catId === currentCatId));

      if (matchesPosition) {
        const isBooked = newStatus === "BOOKED";
        const isPendingByOther = newStatus === "PENDING" && newWorkerId && newWorkerId !== myWorkerId;

        if (isBooked || isPendingByOther) {
          const formattedNum = String(currentPosNum).padStart(2, "0");
          const alertMsg = `Position ${formattedNum} was just booked by another worker.`;
          toast.warning(alertMsg, { duration: 6000 });
          setConfirmError(alertMsg);
          setErrorCode("position_already_booked");
          sessionStorage.removeItem("qw_pending_booking");
        }
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [booking?.jobId, booking?.positionId, booking?.positionNumber, booking?.categoryId, user?.id]);

  // ── Error / loading states ─────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <AlertCircle className="mx-auto size-12 text-destructive/60" />
        <h2 className="mt-4 text-xl font-bold">Nothing to review</h2>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to="/work">Browse shifts</Link>
        </Button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const posNum = posLabel(booking.positionNumber);
  const facilities = booking.facilities ?? ["Meals", "Transport", "Uniform"];

  return (
    <div className="min-h-screen pb-40">
      {/* ── Sticky top nav ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/work/$jobId/positions" params={{ jobId: booking.jobId }}>
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline text-sm">Back to positions</span>
              </Link>
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-muted-foreground/40">Select</span>
              <span className="text-muted-foreground/40">›</span>
              <span className="font-semibold text-foreground">Review</span>
              <span className="text-muted-foreground/40">›</span>
              <span className="text-muted-foreground/40">Done</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="border-b border-border bg-surface"
        style={{ animation: "review-enter 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Step 2 of 2
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            Review your application
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirm the details below. You're applying for one work position.
          </p>

          {/* Rapid Job badge with live countdown */}
          {booking.isRapidJob && (
            <div className="mt-4">
              <RapidJobBadge
                jobDate={booking.jobDate ?? new Date().toISOString().split("T")[0]!}
                startTime={booking.startTime ?? "09:00"}
                {...(booking.endTime !== undefined && { endTime: booking.endTime })}
                rapidJobExpiresAt={booking.rapidJobExpiresAt ?? null}
                variant="large"
                onCutoff={() => setIsRapidCutoff(true)}
              />
            </div>
          )}

          {/* Lock timer */}
          {booking.lockExpiresAt && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm">
              <Clock className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
              <span className="text-muted-foreground">Position held for</span>
              <LockTimer expiresAt={booking.lockExpiresAt} />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8 space-y-5">
        {/* ── Rapid Cutoff Warning ────────────────────────────────────────── */}
        {isRapidCutoff && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
            role="alert"
            style={{ animation: "review-enter 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-bold text-sm">Applications Closed</p>
              <p className="text-xs text-destructive/85 mt-0.5">
                The shift cutoff for this Rapid Job has passed. New applications cannot be submitted.
              </p>
            </div>
          </div>
        )}
        {/* ── Position card ──────────────────────────────────────────────── */}
        <div
          className="rounded-3xl border-2 border-primary/25 bg-primary/[0.03] p-6 shadow-sm"
          style={{ animation: "review-enter 0.42s cubic-bezier(0.22,1,0.36,1) 60ms both" }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Sparkles className="size-4 text-primary/60" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
              Your Work Position
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-4xl font-bold text-foreground leading-none">
                {posNum}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">Position number</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-bold">{booking.categoryName}</p>
              <p className="text-sm text-muted-foreground">Category</p>
            </div>
          </div>
        </div>

        {/* ── Job details card ────────────────────────────────────────────── */}
        <div
          className="rounded-3xl border border-border bg-card p-6"
          style={{ animation: "review-enter 0.42s cubic-bezier(0.22,1,0.36,1) 120ms both" }}
        >
          <div className="mb-1 flex items-center gap-2.5">
            <Briefcase className="size-4 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Job
            </p>
          </div>
          <h2 className="mt-3 text-lg font-bold leading-snug">{booking.jobTitle}</h2>

          <div className="mt-4">
            <DetailRow label="Category" value={booking.categoryName} />
            <DetailRow label="Position" value={`Position ${posNum}`} />
            {booking.jobDate && (
              <DetailRow label="Date" value={formatDate(booking.jobDate)} />
            )}
            {booking.startTime && booking.endTime && (
              <DetailRow
                label="Time"
                value={`${fmt12(booking.startTime)} – ${fmt12(booking.endTime)}`}
              />
            )}
            {booking.area && (
              <DetailRow
                label="Location"
                value={
                  <span className="flex items-center justify-end gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground/50 shrink-0" />
                    {booking.venueName ? `${booking.venueName}, ${booking.area}` : booking.area}
                  </span>
                }
              />
            )}
          </div>
        </div>

        {/* ── Earnings card ────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl border border-border bg-card p-6"
          style={{ animation: "review-enter 0.42s cubic-bezier(0.22,1,0.36,1) 180ms both" }}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <IndianRupee className="size-4 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Earnings
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-display text-4xl font-bold ${
                booking.isRapidJob
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-primary"
              }`}
            >
              ₹{booking.wage.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-muted-foreground">per shift</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Paid via UPI within 24 hours of shift completion
          </p>
          {booking.isRapidJob && (
            <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
              ⚡ Rapid Job — surge pricing included
            </p>
          )}
        </div>

        {/* ── Facilities card ─────────────────────────────────────────────── */}
        {facilities.length > 0 && (
          <div
            className="rounded-3xl border border-border bg-card p-6"
            style={{ animation: "review-enter 0.42s cubic-bezier(0.22,1,0.36,1) 240ms both" }}
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Facilities Included
            </p>
            <div className="flex flex-wrap gap-2.5">
              {facilities.map((f) => {
                const Icon = FACILITY_ICONS[f] ?? Sparkles;
                return (
                  <div
                    key={f}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-sm font-medium"
                  >
                    <Icon className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                    {f}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Confirmation error ──────────────────────────────────────────── */}
        {confirmError && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-destructive/35 bg-destructive/[0.05] px-4 py-4 text-sm"
            role="alert"
            style={{ animation: "review-enter 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">{confirmError}</p>
              {(errorCode === "lock_expired" ||
                errorCode === "no_active_lock" ||
                errorCode === "position_already_booked" ||
                errorCode === "position_unavailable") && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/work/$jobId/positions" params={{ jobId: booking.jobId }}>
                      <ArrowLeft className="size-3.5" />
                      Choose Another Position
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setConfirmError(null); setErrorCode(null); }}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-destructive/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* ── Trust note ──────────────────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3.5 text-xs text-muted-foreground"
          style={{ animation: "review-enter 0.42s cubic-bezier(0.22,1,0.36,1) 300ms both" }}
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success/70" aria-hidden="true" />
          <p>
            By confirming, you commit to attending this shift. Your position is reserved atomically —
            no two workers can book the same position.
          </p>
        </div>
      </div>

      {/* ── Sticky confirm bar ───────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/98 backdrop-blur-md shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.15)]"
        style={{ animation: "bar-rise 0.38s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                Confirming
              </p>
              <p className="mt-0.5 truncate font-semibold">
                {booking.categoryName} · Position {posNum}
              </p>
              <p
                className={`font-display text-lg font-bold ${
                  booking.isRapidJob
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-primary"
                }`}
              >
                ₹{booking.wage.toLocaleString("en-IN")}
              </p>
            </div>
            <Button
              id="confirm-application-btn"
              size="lg"
              disabled={confirming || isRapidCutoff}
              onClick={handleConfirm}
              className={`min-w-[160px] font-bold transition-all active:scale-[0.97] ${
                isRapidCutoff
                  ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                  : booking.isRapidJob
                    ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-[0_4px_18px_color-mix(in_oklab,#F26B1D_38%,transparent)]"
                    : "shadow-brand hover:shadow-brand-lg"
              }`}
            >
              {isRapidCutoff ? (
                "Applications Closed"
              ) : confirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Confirming…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Confirm Application
                  <ArrowRight className="size-4 ml-0.5" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
