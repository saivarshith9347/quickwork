/**
 * /hire/$jobId — Employer: Manage Job Applicants
 *
 * Shows per-category position grid and full applicant list with
 * accept/reject actions backed by Supabase.
 *
 * Falls back to rich mock data when credentials are placeholder/missing.
 *
 * Motion (CSS-only):
 *  - card-enter stagger on applicant cards
 *  - accordion-down/up on category sections
 *  - status badge transition on accept/reject
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  IndianRupee,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Star,
  User,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { ApplicationService } from "@/lib/services/application-service";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/hire/$jobId")({
  head: () => ({
    meta: [
      { title: "Manage Job — QuickWork Employer" },
      {
        name: "description",
        content: "Review applicants, manage positions and fill your job with verified workers.",
      },
    ],
  }),
  component: HireJobPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PositionStatus = "AVAILABLE" | "PENDING" | "BOOKED" | "CANCELLED";
type AppStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type FilterTab = "All" | "Pending" | "Accepted" | "Rejected";

interface WorkerProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface PositionRow {
  id: string;
  position_number: number;
  status: PositionStatus;
  worker_id: string | null;
  application_id: string | null;
  lock_expires_at: string | null;
  worker?: { name: string | null; avatar_url: string | null } | null;
}

interface ApplicantRow {
  id: string;
  worker_id: string;
  job_category_id: string;
  position_id: string;
  status: AppStatus;
  applied_at: string;
  confirmed_at: string | null;
  worker_note: string | null;
  employer_note: string | null;
  worker?: WorkerProfile | null;
  categoryName?: string;
  positionNumber?: number;
}

interface CategoryRow {
  id: string;
  name: string;
  required_workers: number;
  wage: number;
  sort_order: number;
  positions: PositionRow[];
  applicants: ApplicantRow[];
  booked: number;
  available: number;
  pending: number;
}

interface JobDetail {
  id: string;
  job_title: string;
  venue_name: string;
  area: string;
  city: string;
  job_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_rapid_job: boolean;
  facilities: string[];
  categories: CategoryRow[];
  totalPositions: number;
  filledPositions: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

function buildMockDetail(jobId: string): JobDetail {
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;

  return {
    id: jobId,
    job_title: "Wedding Event Staff",
    venue_name: "Grand Sapphire Banquets",
    area: "Gachibowli",
    city: "Hyderabad",
    job_date: today,
    start_time: "19:00",
    end_time: "23:00",
    status: "PartiallyFilled",
    is_rapid_job: true,
    facilities: ["Meals", "Transport", "Uniform"],
    categories: [
      {
        id: "c1", name: "Food Serving", required_workers: 5, wage: 1200, sort_order: 1,
        booked: 3, available: 1, pending: 1,
        positions: [
          { id: "p1", position_number: 1, status: "BOOKED",    worker_id: "w1", application_id: "a1", lock_expires_at: null, worker: { name: "Rahul K.", avatar_url: null } },
          { id: "p2", position_number: 2, status: "BOOKED",    worker_id: "w2", application_id: "a2", lock_expires_at: null, worker: { name: "Sana M.", avatar_url: null } },
          { id: "p3", position_number: 3, status: "BOOKED",    worker_id: "w3", application_id: "a3", lock_expires_at: null, worker: { name: "Arjun R.", avatar_url: null } },
          { id: "p4", position_number: 4, status: "PENDING",   worker_id: null, application_id: null, lock_expires_at: new Date(now.getTime() + 90000).toISOString(), worker: null },
          { id: "p5", position_number: 5, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
        ],
        applicants: [
          { id: "a1", worker_id: "w1", job_category_id: "c1", position_id: "p1", status: "ACCEPTED", applied_at: new Date(now.getTime()-3600000).toISOString(), confirmed_at: new Date().toISOString(), worker_note: "5 years event experience.", employer_note: null, categoryName: "Food Serving", positionNumber: 1, worker: { id: "w1", name: "Rahul Kumar", avatar_url: null, phone: "+91 98765 43210" } },
          { id: "a2", worker_id: "w2", job_category_id: "c1", position_id: "p2", status: "ACCEPTED", applied_at: new Date(now.getTime()-3000000).toISOString(), confirmed_at: new Date().toISOString(), worker_note: "Available full shift.", employer_note: null, categoryName: "Food Serving", positionNumber: 2, worker: { id: "w2", name: "Sana Mirza", avatar_url: null, phone: "+91 98765 43211" } },
          { id: "a3", worker_id: "w3", job_category_id: "c1", position_id: "p3", status: "ACCEPTED", applied_at: new Date(now.getTime()-2400000).toISOString(), confirmed_at: new Date().toISOString(), worker_note: null, employer_note: null, categoryName: "Food Serving", positionNumber: 3, worker: { id: "w3", name: "Arjun Reddy", avatar_url: null, phone: "+91 98765 43212" } },
          { id: "a4", worker_id: "w4", job_category_id: "c1", position_id: "p4", status: "PENDING",  applied_at: new Date(now.getTime()-1800000).toISOString(), confirmed_at: null, worker_note: "Ready for any shift.", employer_note: null, categoryName: "Food Serving", worker: { id: "w4", name: "Meena Sharma", avatar_url: null, phone: "+91 98765 43213" } },
          { id: "a5", worker_id: "w5", job_category_id: "c1", position_id: "p5", status: "PENDING",  applied_at: new Date(now.getTime()-900000).toISOString(), confirmed_at: null, worker_note: "3 years banquet experience. References available.", employer_note: null, categoryName: "Food Serving", worker: { id: "w5", name: "Vikram Singh", avatar_url: null, phone: "+91 98765 43214" } },
        ],
      },
      {
        id: "c2", name: "Liquor Serving", required_workers: 3, wage: 1400, sort_order: 2,
        booked: 2, available: 1, pending: 0,
        positions: [
          { id: "p6", position_number: 1, status: "BOOKED",    worker_id: "w6", application_id: "a6", lock_expires_at: null, worker: { name: "Priya D.", avatar_url: null } },
          { id: "p7", position_number: 2, status: "BOOKED",    worker_id: "w7", application_id: "a7", lock_expires_at: null, worker: { name: "Dev K.", avatar_url: null } },
          { id: "p8", position_number: 3, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
        ],
        applicants: [],
      },
      {
        id: "c3", name: "Starters Serving", required_workers: 2, wage: 1200, sort_order: 3,
        booked: 2, available: 0, pending: 0,
        positions: [
          { id: "p9",  position_number: 1, status: "BOOKED", worker_id: "w8", application_id: "a8", lock_expires_at: null, worker: { name: "Deepa L.", avatar_url: null } },
          { id: "p10", position_number: 2, status: "BOOKED", worker_id: "w9", application_id: "a9", lock_expires_at: null, worker: { name: "Suresh P.", avatar_url: null } },
        ],
        applicants: [],
      },
      {
        id: "c4", name: "Juice Serving", required_workers: 2, wage: 1100, sort_order: 4,
        booked: 1, available: 1, pending: 0,
        positions: [
          { id: "p11", position_number: 1, status: "BOOKED",    worker_id: "w10", application_id: "a10", lock_expires_at: null, worker: { name: "Anita K.", avatar_url: null } },
          { id: "p12", position_number: 2, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
        ],
        applicants: [
          { id: "a11", worker_id: "w11", job_category_id: "c4", position_id: "p12", status: "PENDING", applied_at: new Date(now.getTime()-600000).toISOString(), confirmed_at: null, worker_note: null, employer_note: null, categoryName: "Juice Serving", worker: { id: "w11", name: "Ravi Teja", avatar_url: null, phone: "+91 98765 43215" } },
        ],
      },
    ],
    totalPositions: 12,
    filledPositions: 8,
  };
}

// ─── Supabase fetch ────────────────────────────────────────────────────────────

async function fetchJobDetail(jobId: string): Promise<JobDetail> {
  try {
    const client = getSupabase();
    if (!client) return buildMockDetail(jobId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error } = await (client as any)
      .from("jobs")
      .select(`
        id, job_title, venue_name, area, city, job_date, start_time, end_time,
        status, is_rapid_job, facilities,
        job_categories (
          id, name, required_workers, wage, sort_order,
          job_positions (
            id, position_number, status, worker_id, application_id, lock_expires_at,
            worker:public_profiles!job_positions_worker_id_fkey ( name, avatar_url )
          ),
          applications (
            id, worker_id, job_category_id, position_id, status, applied_at, confirmed_at,
            worker_note, employer_note,
            worker:public_profiles!applications_worker_id_fkey ( id, name, avatar_url, phone )
          )
        )
      `)
      .eq("id", jobId)
      .single();

    if (error || !job) return buildMockDetail(jobId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = job as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categories: CategoryRow[] = ((j.job_categories ?? []) as any[])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((cat: any): CategoryRow => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const positions: PositionRow[] = ((cat.job_positions ?? []) as any[])
          .sort((a: { position_number: number }, b: { position_number: number }) => a.position_number - b.position_number);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const applicants: ApplicantRow[] = (cat.applications ?? []) as any[];
        return {
          id: cat.id,
          name: cat.name,
          required_workers: cat.required_workers,
          wage: cat.wage,
          sort_order: cat.sort_order,
          positions,
          applicants: applicants.map((a) => ({
            ...a,
            categoryName: cat.name,
            positionNumber: positions.find((p) => p.id === a.position_id)?.position_number,
          } as ApplicantRow)),
          booked: positions.filter((p) => p.status === "BOOKED").length,
          available: positions.filter((p) => p.status === "AVAILABLE").length,
          pending: positions.filter((p) => p.status === "PENDING").length,
        };
      });

    return {
      id: j.id,
      job_title: j.job_title,
      venue_name: j.venue_name,
      area: j.area,
      city: j.city,
      job_date: j.job_date,
      start_time: (j.start_time as string).slice(0, 5),
      end_time: (j.end_time as string).slice(0, 5),
      status: j.status,
      is_rapid_job: j.is_rapid_job,
      facilities: (j.facilities as string[]) ?? [],
      categories,
      totalPositions: categories.reduce((s, c) => s + c.required_workers, 0),
      filledPositions: categories.reduce((s, c) => s + c.booked, 0),
    };
  } catch {
    return buildMockDetail(jobId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0]!;
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]!; })();

function fmtDate(iso: string) {
  if (iso === TODAY) return "Today";
  if (iso === TOMORROW) return "Tomorrow";
  const d = new Date(iso + "T00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const s = h! >= 12 ? "PM" : "AM";
  const d = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  return `${d}:${String(m!).padStart(2, "0")} ${s}`;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function posLabel(n: number, total: number) {
  const digits = total >= 100 ? 3 : 2;
  return String(n).padStart(digits, "0");
}

function timeAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

// ─── Status configs ───────────────────────────────────────────────────────────

const POS_CFG: Record<PositionStatus, { label: string; bg: string; num: string; dot: string }> = {
  AVAILABLE: { label: "Available", bg: "border-success/30 bg-success/[0.06]",               num: "text-foreground",          dot: "bg-success"                     },
  PENDING:   { label: "On Hold",   bg: "border-amber-500/35 bg-amber-500/[0.06]",            num: "text-foreground",          dot: "bg-amber-500 animate-pulse"     },
  BOOKED:    { label: "Booked",    bg: "border-primary/25 bg-primary/[0.06]",                num: "text-primary",             dot: "bg-primary"                     },
  CANCELLED: { label: "Cancelled", bg: "border-border/40 bg-muted/20 opacity-40",            num: "text-muted-foreground",    dot: "bg-muted-foreground"             },
};

const APP_CFG: Record<AppStatus, { label: string; badge: string; dot: string }> = {
  PENDING:   { label: "Pending",   badge: "border-amber-500/35 bg-amber-500/8  text-amber-600 dark:text-amber-400", dot: "bg-amber-500"         },
  ACCEPTED:  { label: "Accepted",  badge: "border-success/35  bg-success/8    text-success",                        dot: "bg-success"           },
  REJECTED:  { label: "Rejected",  badge: "border-destructive/30 bg-destructive/8 text-destructive",                dot: "bg-destructive"       },
  CANCELLED: { label: "Cancelled", badge: "border-border bg-muted text-muted-foreground",                           dot: "bg-muted-foreground"  },
  COMPLETED: { label: "Completed", badge: "border-border bg-muted text-muted-foreground",                           dot: "bg-muted-foreground"  },
};

// ─── Position tile ────────────────────────────────────────────────────────────

function PositionTile({ pos, total }: { pos: PositionRow; total: number }) {
  const cfg = POS_CFG[pos.status];
  return (
    <div className={`flex min-w-[72px] flex-col items-center rounded-xl border-2 p-3 text-center transition-all ${cfg.bg}`}>
      <span className={`font-display text-xl font-bold leading-none ${cfg.num}`}>
        {posLabel(pos.position_number, total)}
      </span>
      <span className={`mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
        pos.status === "BOOKED" ? "text-primary/70" : pos.status === "PENDING" ? "text-amber-500/80" : pos.status === "AVAILABLE" ? "text-success/70" : "text-muted-foreground/40"
      }`}>
        <span className={`size-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
      {pos.worker?.name && (
        <span className="mt-1.5 max-w-[68px] truncate text-[10px] font-medium text-muted-foreground">
          {pos.worker.name.split(" ")[0]}
        </span>
      )}
    </div>
  );
}

// ─── Applicant card ───────────────────────────────────────────────────────────

function ApplicantCard({
  app,
  enterDelay,
  isMock,
  onUpdate,
}: {
  app: ApplicantRow;
  enterDelay: number;
  isMock: boolean;
  onUpdate: (id: string, status: AppStatus) => void;
}) {
  const [acting, setActing] = useState(false);
  const cfg = APP_CFG[app.status];

  async function act(newStatus: "ACCEPTED" | "REJECTED") {
    setActing(true);
    if (!isMock) {
      const result = await ApplicationService.updateApplicationStatus(app.id, newStatus);
      if (!result.success) {
        toast.error(`Action failed: ${result.error}`);
        setActing(false);
        return;
      }

      // Keep position table in sync if position is tied to this application
      if (app.position_id) {
        const client = getSupabase();
        if (client) {
          if (newStatus === "ACCEPTED") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client as any).from("job_positions").update({
              status: "BOOKED",
              worker_id: app.worker_id,
              application_id: app.id,
              lock_expires_at: null,
            }).eq("id", app.position_id);
          } else if (newStatus === "REJECTED") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client as any).from("job_positions").update({
              status: "AVAILABLE",
              worker_id: null,
              application_id: null,
              lock_expires_at: null,
            }).eq("id", app.position_id).eq("worker_id", app.worker_id);
          }
        }
      }
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (newStatus === "ACCEPTED") toast.success(`${app.worker?.name ?? "Applicant"} accepted!`);
    onUpdate(app.id, newStatus);
    setActing(false);
  }

  return (
    <div
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/20 hover:shadow-lift"
      style={{ animation: `card-enter 0.38s cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both` }}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Avatar */}
        <div
          className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-primary-foreground ${
            app.status === "ACCEPTED" ? "bg-success" : app.status === "REJECTED" ? "bg-muted-foreground" : "bg-primary/80"
          }`}
        >
          {initials(app.worker?.name)}
          {app.status === "ACCEPTED" && (
            <CheckCircle2 className="absolute -bottom-1.5 -right-1.5 size-4 fill-success text-white" aria-hidden="true" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm">{app.worker?.name ?? "Unknown"}</p>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
              <span className={`size-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {app.categoryName && (
              <span className="flex items-center gap-1">
                <Layers className="size-3 shrink-0" />
                {app.categoryName}
              </span>
            )}
            {app.positionNumber !== undefined && (
              <span className="flex items-center gap-1">
                <User className="size-3 shrink-0" />
                Position {posLabel(app.positionNumber, 99)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              {timeAgo(app.applied_at)}
            </span>
          </div>

          {/* Worker note */}
          {app.worker_note && (
            <blockquote className="mt-2 rounded-lg border-l-2 border-primary/30 bg-muted/30 pl-3 pr-2 py-2 text-xs italic text-muted-foreground">
              "{app.worker_note}"
            </blockquote>
          )}

          {/* Confirmed note */}
          {app.status === "ACCEPTED" && app.confirmed_at && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Confirmed · {timeAgo(app.confirmed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {app.status === "PENDING" && (
        <div className="flex border-t border-border">
          <button
            id={`reject-${app.id}`}
            type="button"
            disabled={acting}
            onClick={() => act("REJECTED")}
            className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50"
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Reject
          </button>
          <div className="w-px bg-border" />
          <button
            id={`accept-${app.id}`}
            type="button"
            disabled={acting}
            onClick={() => act("ACCEPTED")}
            className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold text-success transition-colors hover:bg-success/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50"
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Accept
          </button>
        </div>
      )}
      {(app.status === "ACCEPTED" || app.status === "REJECTED") && (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-center text-xs text-muted-foreground/70">
            {app.status === "ACCEPTED" ? "✓ Worker has been notified" : "✗ Worker has been declined"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  cat,
  defaultOpen,
  isMock,
  onAppUpdate,
  appFilter,
}: {
  cat: CategoryRow;
  defaultOpen: boolean;
  isMock: boolean;
  onAppUpdate: (catId: string, appId: string, status: AppStatus) => void;
  appFilter: FilterTab;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [applicants, setApplicants] = useState(cat.applicants);
  const pct = cat.required_workers > 0 ? Math.round((cat.booked / cat.required_workers) * 100) : 0;

  const filteredApplicants = applicants.filter((a) => {
    if (appFilter === "All") return true;
    if (appFilter === "Pending") return a.status === "PENDING";
    if (appFilter === "Accepted") return a.status === "ACCEPTED";
    if (appFilter === "Rejected") return a.status === "REJECTED";
    return true;
  });

  const pendingCount = applicants.filter((a) => a.status === "PENDING").length;

  function handleUpdate(appId: string, status: AppStatus) {
    setApplicants((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    onAppUpdate(cat.id, appId, status);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold">{cat.name}</h3>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-2.5" />
                {pendingCount} pending
              </span>
            )}
          </div>

          {/* Fill progress */}
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    pct === 100 ? "bg-success" : pct >= 50 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className={`shrink-0 font-display text-sm font-bold tabular-nums ${
              pct === 100 ? "text-success" : pct > 0 ? "text-amber-500" : "text-muted-foreground"
            }`}>
              {cat.booked} / {cat.required_workers} filled
            </span>
          </div>

          {/* Counts row */}
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" />{cat.booked} booked</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />{cat.pending} on hold</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-success" />{cat.available} open</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-lg font-bold text-primary">₹{cat.wage.toLocaleString("en-IN")}</span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expandable body */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "3000px" : "0",
          opacity: open ? 1 : 0,
          transition: open
            ? "max-height 0.42s cubic-bezier(0.22,1,0.36,1), opacity 0.28s ease"
            : "max-height 0.3s cubic-bezier(0.4,0,1,1), opacity 0.18s ease",
        }}
      >
        <div className="border-t border-border px-5 pb-6 pt-5 space-y-6">
          {/* Positions grid */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Work Positions ({cat.required_workers})
            </p>
            <div className="flex flex-wrap gap-3">
              {cat.positions.map((pos) => (
                <PositionTile key={pos.id} pos={pos} total={cat.required_workers} />
              ))}
            </div>
          </div>

          {/* Applicants */}
          {filteredApplicants.length > 0 ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                Applicants ({filteredApplicants.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredApplicants.map((app, i) => (
                  <ApplicantCard
                    key={app.id}
                    app={app}
                    enterDelay={i * 55}
                    isMock={isMock}
                    onUpdate={(appId, status) => handleUpdate(appId, status)}
                  />
                ))}
              </div>
            </div>
          ) : (
            applicants.length > 0 && appFilter !== "All" ? (
              <p className="text-sm text-muted-foreground/60">No {appFilter.toLowerCase()} applicants in this category.</p>
            ) : applicants.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">
                No applicants yet. {cat.available > 0 ? `${cat.available} position${cat.available > 1 ? "s" : ""} available.` : ""}
              </p>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HireJobPage() {
  const { jobId } = Route.useParams();
  const { user, isLoggedIn, openLoginModal } = useAuth();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [appFilter, setAppFilter] = useState<FilterTab>("All");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await fetchJobDetail(jobId);
      if (!cancelled) {
        setIsMock(!user?.id || data.id === jobId && jobId.startsWith("mock-") === true);
        setJob(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleAppUpdate = useCallback((catId: string, appId: string, status: AppStatus) => {
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id !== catId ? cat : {
            ...cat,
            applicants: cat.applicants.map((a) => a.id === appId ? { ...a, status } : a),
            booked: status === "ACCEPTED" ? cat.booked + 1 : cat.booked,
          },
        ),
      };
    });
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <Briefcase className="mx-auto size-12 text-muted-foreground/30" />
        <h2 className="mt-4 text-xl font-bold">Sign in to manage jobs</h2>
        <Button variant="hero" className="mt-6" onClick={() => openLoginModal()}>
          Sign in
        </Button>
      </div>
    );
  }

  if (loading || !job) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading job details…</span>
        </div>
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  const fillPct = job.totalPositions > 0 ? Math.round((job.filledPositions / job.totalPositions) * 100) : 0;
  const totalApplicants = job.categories.reduce((s, c) => s + c.applicants.length, 0);
  const pendingApplicants = job.categories.reduce((s, c) => s + c.applicants.filter((a) => a.status === "PENDING").length, 0);

  const FILTER_TABS: FilterTab[] = ["All", "Pending", "Accepted", "Rejected"];

  return (
    <div className="min-h-screen pb-16">
      {/* ── Sticky nav ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/my-jobs">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline text-sm">My Jobs</span>
              </Link>
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <span className="truncate text-sm font-semibold text-muted-foreground">{job.job_title}</span>
            {isMock && (
              <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 font-medium">Preview</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Job header ──────────────────────────────────────────────────── */}
      <div
        className={`border-b border-border ${job.is_rapid_job ? "bg-gradient-to-br from-orange-500/5 via-surface to-surface" : "bg-surface"}`}
        style={{ animation: "review-enter 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {job.is_rapid_job && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500/50 bg-orange-500/12 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                    <Zap className="size-3 fill-current" />
                    Rapid Job
                  </span>
                )}
                {pendingApplicants > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/8 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="size-3" />
                    {pendingApplicants} pending
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{job.job_title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0" />
                  {job.venue_name}, {job.area}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0" />
                  {fmtDate(job.job_date)} · {fmt12(job.start_time)} – {fmt12(job.end_time)}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setLoading(true);
                const data = await fetchJobDetail(jobId);
                setJob(data);
                setLoading(false);
                toast.success("Refreshed");
              }}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>

          {/* Overall stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Positions", value: job.totalPositions,  Icon: Users,      color: "text-foreground" },
              { label: "Filled",          value: job.filledPositions,  Icon: CheckCircle2, color: "text-success"  },
              { label: "Applicants",      value: totalApplicants,       Icon: BadgeCheck, color: "text-primary"   },
              { label: "Pending Review",  value: pendingApplicants,     Icon: Clock,      color: "text-amber-500" },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4 text-center">
                <Icon className={`mx-auto size-5 ${color}`} aria-hidden="true" />
                <p className={`mt-1.5 font-display text-2xl font-bold ${color}`}>{value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Overall fill bar */}
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Overall fill rate</span>
              <span className="font-bold text-foreground">{fillPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full rounded-full transition-all duration-700 ${fillPct === 100 ? "bg-success" : fillPct >= 50 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Applicant filter tabs ────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-3" style={{ scrollbarWidth: "none" }}>
            {FILTER_TABS.map((f) => {
              const count = job.categories.reduce((s, c) => {
                const apps = f === "All" ? c.applicants
                  : f === "Pending" ? c.applicants.filter((a) => a.status === "PENDING")
                  : f === "Accepted" ? c.applicants.filter((a) => a.status === "ACCEPTED")
                  : c.applicants.filter((a) => a.status === "REJECTED");
                return s + apps.length;
              }, 0);

              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={appFilter === f}
                  onClick={() => setAppFilter(f)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    appFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f}
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                    appFilter === f ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8 space-y-5">
        {job.categories.map((cat, i) => (
          <CategorySection
            key={cat.id}
            cat={cat}
            defaultOpen={i === 0}
            isMock={isMock}
            onAppUpdate={(catId, appId, status) => handleAppUpdate(catId, appId, status)}
            appFilter={appFilter}
          />
        ))}
      </div>
    </div>
  );
}
