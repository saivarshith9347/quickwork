import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  Info,
  Loader2,
  MapPin,
  Share2,
  Timer,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useApplication } from "@/lib/hooks/use-applications";
import { useJob } from "@/lib/hooks/use-jobs";
import { formatLocation } from "@/lib/job-types";
import { getSupabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/checkout")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { applicationId?: string | undefined; jobId?: string | undefined } => {
    return {
      applicationId:
        typeof search["applicationId"] === "string" ? search["applicationId"] : undefined,
      jobId: typeof search["jobId"] === "string" ? search["jobId"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Check Out — QuickWork" },
      {
        name: "description",
        content: "Confirm shift completion and track your UPI payment status on QuickWork.",
      },
    ],
  }),
  component: CheckoutPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentStatus = "pending" | "manual_settlement" | "gateway_not_configured";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
  
  return (endMinutes - startMinutes) / 60;
}

function fmt(hrs: number) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0 text-primary/70" />
        {label}
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Payment status card ──────────────────────────────────────────────────────

function PaymentCard({
  status,
  wage,
  txnRef,
}: {
  status: PaymentStatus;
  wage: number;
  txnRef: string;
}) {
  const isSettlementPending = status === "manual_settlement" || status === "gateway_not_configured";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Payment status: ${status}`}
      className={`relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 ${
        isSettlementPending ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <div className="relative">
        {/* Icon & Label */}
        <div className="flex items-center gap-4">
          <div
            className={`flex size-16 items-center justify-center rounded-2xl transition-all duration-500 ${
              isSettlementPending ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {isSettlementPending ? <Clock className="size-8" /> : <Wallet className="size-8" />}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Payment status
            </p>
            <p
              className={`mt-1 text-2xl font-bold font-display transition-colors duration-500 ${
                isSettlementPending ? "text-primary" : "text-foreground"
              }`}
            >
              {isSettlementPending
                ? "Shift Completed · Settlement Pending"
                : "Pending Confirmation"}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div
          className={`mt-6 flex items-center justify-between rounded-2xl p-5 border border-border bg-muted/40`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IndianRupee className="size-4" />
            Wage for shift
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-foreground">
            ₹{wage.toLocaleString("en-IN")}
          </p>
        </div>

        {/* Details */}
        <div className="mt-5 space-y-3 animate-rise">
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="size-4 text-primary shrink-0" />
            <span className="text-muted-foreground">
              Settlement reference:{" "}
              <span className="font-mono font-semibold text-foreground">{txnRef}</span>
            </span>
          </div>
        </div>

        {/* Notice regarding payment */}
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-muted-foreground flex items-start gap-2.5">
          <Info className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            Payment is settled directly with the employer. The employer verifies attendance and
            completes payment settlement directly.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Check-out screen ─────────────────────────────────────────────────────────

function CheckoutPage() {
  const { applicationId, jobId } = Route.useSearch();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading } = useApplication(applicationId, { enabled: !!applicationId });
  const targetJobId = jobId || application?.jobId;
  const { data: job, isLoading: jobLoading } = useJob(targetJobId, { enabled: !!targetJobId });

  // Fetch employer name from public_profiles
  const { data: employerData } = useQuery({
    queryKey: ["employer", job?.employerId],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !job?.employerId) return null;

      const { data, error } = await supabase
        .from("public_profiles")
        .select("name")
        .eq("id", job.employerId)
        .single();

      if (error || !data) return null;
      return data.name;
    },
    enabled: !!job?.employerId,
  });

  const [phase, setPhase] = useState<"summary" | "payment">("summary");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("pending");
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (appLoading || jobLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!application || !job) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 text-center lg:px-8">
        <AlertCircle className="mx-auto size-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Application or Job not found</h1>
        <p className="mt-2 text-muted-foreground">
          Unable to load checkout details. Please try again.
        </p>
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/my-applications">Back to My Applications</Link>
        </Button>
      </div>
    );
  }

  const hoursWorked = calculateHours(job.startTime, job.endTime);

  const displayShift = {
    role: job.jobTitle,
    employer: employerData || "Employer",
    venue:
      typeof job.location === "object"
        ? job.location.venueName
        : formatLocation(job.location, "short"),
    area:
      typeof job.location === "object"
        ? job.location.area
        : formatLocation(job.location, "short"),
    date: new Date(job.date).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    checkIn: job.startTime,
    checkOut: job.endTime,
    hoursWorked,
    wagePerShift: job.wage,
    txnRef: applicationId ? `TXN${applicationId.slice(0, 8).toUpperCase()}` : "N/A",
    workerName: user?.name ?? user?.email ?? "Worker",
  };

  async function handleConfirmCheckout() {
    if (!applicationId) {
      toast.error("Application ID is missing");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const supabase = getSupabase();
      if (!supabase) {
        toast.error("Unable to connect to database");
        setIsSubmitting(false);
        return;
      }

      // Call complete_my_shift RPC
      const { data, error } = await supabase.rpc("complete_my_shift", {
        p_application_id: applicationId,
      });

      if (error) {
        console.error("Failed to complete shift:", error);
        toast.error("Failed to complete shift", {
          description: error.message || "Unable to mark shift as completed. Please try again.",
        });
        setIsSubmitting(false);
        return;
      }

      const result = data as { success?: boolean; error?: string } | null;

      if (!result || !result.success) {
        const errorMessage = result?.error || "Failed to complete shift";
        
        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          not_authenticated: "Please log in to complete your shift",
          application_not_found: "Application not found",
          not_your_application: "You can only complete your own shifts",
          application_not_accepted: "Only accepted shifts can be completed",
          job_not_found: "Job not found",
          shift_not_yet_started: "Shift cannot be completed before the job date",
        };

        toast.error("Could not complete shift", {
          description: errorMessages[errorMessage] || errorMessage,
        });
        setIsSubmitting(false);
        return;
      }

      setPhase("payment");
      setPayStatus("manual_settlement");
      toast.success("Shift completion recorded");
    } catch (error) {
      console.error("Exception completing shift:", error);
      toast.error("An error occurred", {
        description: "Unable to complete shift. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Phase 1: Job summary + check-out confirmation ──

  if (phase === "summary") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Shift complete</p>
            <h1 className="mt-2 text-4xl font-bold font-display sm:text-5xl">Check out</h1>
            <p className="mt-3 text-muted-foreground">
              Review your shift summary and confirm to complete.
            </p>
          </div>
        </div>

        {/* Worker + employer card */}
        <div className="mt-10 rounded-3xl border border-border bg-surface p-7">
          <div className="flex flex-wrap items-start gap-5">
            {/* Avatar */}
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-2xl font-bold text-primary-foreground shadow-brand">
              {displayShift.workerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{displayShift.workerName}</h2>
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="size-4" />
                {displayShift.role}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {displayShift.venue}, {displayShift.area}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-xs text-muted-foreground">Employer</p>
              <p className="font-semibold text-sm">{displayShift.employer}</p>
            </div>
          </div>
        </div>

        {/* Shift details */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-7">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Shift summary
          </h3>
          <div className="mt-4">
            <SummaryRow icon={CalendarCheck} label="Date" value={displayShift.date} />
            <SummaryRow icon={Clock} label="Check-in" value={displayShift.checkIn} />
            <SummaryRow icon={Clock} label="Check-out" value={displayShift.checkOut} />
            <SummaryRow icon={Timer} label="Hours worked" value={fmt(displayShift.hoursWorked)} />
            <SummaryRow
              icon={Banknote}
              label="Wage"
              value={`₹${displayShift.wagePerShift.toLocaleString("en-IN")}`}
              highlight
            />
          </div>
        </div>

        {/* Attendance confirmation */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-7">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Shift completion
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            By confirming, you acknowledge that{" "}
            <span className="font-semibold text-foreground">{displayShift.workerName}</span>{" "}
            completed this shift. Payment is settled directly with the employer:{" "}
            <span className="font-semibold text-primary">
              ₹{displayShift.wagePerShift.toLocaleString("en-IN")}
            </span>
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={confirmed}
              onClick={() => setConfirmed((c) => !c)}
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                confirmed
                  ? "border-success bg-success text-success-foreground"
                  : "border-input bg-background"
              }`}
            >
              {confirmed && <CheckCircle2 className="size-3.5" strokeWidth={3} />}
            </button>
            <span className="text-sm leading-relaxed">
              I confirm the shift was completed as described and the wage amount is correct.
            </span>
          </label>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!confirmed || isSubmitting}
            onClick={handleConfirmCheckout}
            aria-disabled={!confirmed || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Confirm check-out
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Payment is settled directly with the employer
          </p>
        </div>
      </div>
    );
  }

  // ── Phase 2: Payment status ──

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 lg:px-8">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-primary">Settlement</p>
        <h1 className="mt-2 text-4xl font-bold font-display sm:text-5xl">Shift Completed</h1>
        <p className="mt-3 text-muted-foreground">
          Shift completion confirmed and submitted for payout review. Great work today.
        </p>
      </div>

      {/* Payment card */}
      <div className="mt-10">
        <PaymentCard
          status={payStatus}
          wage={displayShift.wagePerShift}
          txnRef={displayShift.txnRef}
        />
      </div>

      {/* Shift recap pill */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Briefcase className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{displayShift.role}</p>
          <p className="text-xs text-muted-foreground truncate">
            {displayShift.employer} · {displayShift.date}
          </p>
        </div>
        <span className="font-display text-xl font-bold text-primary">
          ₹{displayShift.wagePerShift.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Post-completion actions */}
      <div className="mt-8 flex flex-col gap-3 animate-rise">
        <Button variant="hero" size="lg" className="w-full" asChild>
          <Link to="/work">
            Browse more shifts <ArrowRight />
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" asChild>
            <Link to="/my-applications">My Applications</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "QuickWork",
                  text: `Just completed a shift as ${displayShift.role} and recorded settlement on QuickWork!`,
                });
              } else {
                toast.success("Link copied to clipboard");
              }
            }}
          >
            <Share2 className="size-4" />
            Share
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground pt-1">
          Reference:{" "}
          <span className="font-mono font-semibold text-foreground">{displayShift.txnRef}</span>
        </p>
      </div>
    </div>
  );
}
