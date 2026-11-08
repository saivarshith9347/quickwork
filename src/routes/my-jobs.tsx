/**
 * /my-jobs — Employer Job Dashboard
 *
 * Full Supabase-powered redesign. Shows all jobs posted by the logged-in
 * employer with category-level breakdown, expandable manage panel, and
 * filtered tabs.
 *
 * Supabase queries:
 *  - jobs (with job_categories → job_positions, applications + profiles join)
 *
 * Falls back to rich mock data when credentials are placeholder/missing.
 *
 * Motion (CSS-only):
 *  - card-enter stagger on load
 *  - accordion-down/up on manage panel expand
 *  - count-pop when fill numbers change
 *  - bar-rise on progress bars
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  Star,
  Users,
  XCircle,
  Zap,
  User,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { ApplicationService } from "@/lib/services/application-service";
import { formatLocation } from "@/lib/job-types";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/my-jobs")({
  head: () => ({
    meta: [
      { title: "My Jobs — QuickWork Employer" },
      {
        name: "description",
        content:
          "Manage your posted jobs. Track applicants, positions, and fill status across all categories.",
      },
    ],
  }),
  component: MyJobsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type DBJobStatus = "Open" | "PartiallyFilled" | "FullyFilled" | "Completed" | "Cancelled";
type PositionStatus = "AVAILABLE" | "PENDING" | "BOOKED" | "CANCELLED";
type AppStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type TabFilter = "All" | "Live" | "Rapid" | "PartiallyFilled" | "FullyFilled" | "Completed" | "Cancelled";

interface WorkerProfile {
  name: string | null;
  avatar_url: string | null;
}

interface PositionRow {
  id: string;
  position_number: number;
  status: PositionStatus;
  worker_id: string | null;
  application_id: string | null;
  lock_expires_at: string | null;
  worker?: WorkerProfile | null;
}

interface ApplicantRow {
  id: string;
  worker_id: string;
  status: AppStatus;
  applied_at: string;
  worker_note: string | null;
  employer_note: string | null;
  worker?: WorkerProfile | null;
  position_number?: number;
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

interface JobRow {
  id: string;
  job_title: string;
  venue_name: string;
  area: string;
  city: string;
  job_date: string;
  start_time: string;
  end_time: string;
  status: DBJobStatus;
  is_rapid_job: boolean;
  rapid_job_expires_at: string | null;
  categories: CategoryRow[];
  totalPositions: number;
  filledPositions: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

function buildMockData(): JobRow[] {
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;

  return [
    {
      id: "mock-1",
      job_title: "Wedding Event Staff",
      venue_name: "Grand Sapphire Banquets",
      area: "Gachibowli",
      city: "Hyderabad",
      job_date: today,
      start_time: "19:00",
      end_time: "23:00",
      status: "PartiallyFilled",
      is_rapid_job: true,
      rapid_job_expires_at: new Date(now.getTime() + 90 * 60000).toISOString(),
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
            { id: "a1", worker_id: "w1", status: "ACCEPTED", applied_at: new Date(now.getTime() - 3600000).toISOString(), worker_note: "5 years exp.", employer_note: null, worker: { name: "Rahul K.", avatar_url: null }, position_number: 1 } as ApplicantRow,
            { id: "a4", worker_id: "w4", status: "PENDING",  applied_at: new Date(now.getTime() - 1800000).toISOString(), worker_note: "Available all day", employer_note: null, worker: { name: "Meena S.", avatar_url: null } } as ApplicantRow,
          ],
        },
        {
          id: "c2", name: "Liquor Serving", required_workers: 3, wage: 1400, sort_order: 2,
          booked: 2, available: 1, pending: 0,
          positions: [
            { id: "p6", position_number: 1, status: "BOOKED",    worker_id: "w5", application_id: "a5", lock_expires_at: null, worker: { name: "Vikram S.", avatar_url: null } },
            { id: "p7", position_number: 2, status: "BOOKED",    worker_id: "w6", application_id: "a6", lock_expires_at: null, worker: { name: "Priya D.", avatar_url: null } },
            { id: "p8", position_number: 3, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
          ],
          applicants: [],
        },
        {
          id: "c3", name: "Starters Serving", required_workers: 2, wage: 1200, sort_order: 3,
          booked: 2, available: 0, pending: 0,
          positions: [
            { id: "p9",  position_number: 1, status: "BOOKED", worker_id: "w7", application_id: "a7", lock_expires_at: null, worker: { name: "Deepa L.", avatar_url: null } },
            { id: "p10", position_number: 2, status: "BOOKED", worker_id: "w8", application_id: "a8", lock_expires_at: null, worker: { name: "Suresh P.", avatar_url: null } },
          ],
          applicants: [],
        },
        {
          id: "c4", name: "Juice Serving", required_workers: 2, wage: 1100, sort_order: 4,
          booked: 1, available: 1, pending: 0,
          positions: [
            { id: "p11", position_number: 1, status: "BOOKED",    worker_id: "w9", application_id: "a9", lock_expires_at: null, worker: { name: "Anita K.", avatar_url: null } },
            { id: "p12", position_number: 2, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
          ],
          applicants: [
            { id: "a10", worker_id: "w10", status: "PENDING", applied_at: new Date(now.getTime() - 900000).toISOString(), worker_note: null, employer_note: null, worker: { name: "Ravi T.", avatar_url: null } } as ApplicantRow,
          ],
        },
      ],
      totalPositions: 12,
      filledPositions: 8,
    },
    {
      id: "mock-2",
      job_title: "Corporate Conference Staff",
      venue_name: "Hitex Exhibition Centre",
      area: "HITEC City",
      city: "Hyderabad",
      job_date: (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split("T")[0]!; })(),
      start_time: "09:00",
      end_time: "18:00",
      status: "Open",
      is_rapid_job: false,
      rapid_job_expires_at: null,
      categories: [
        {
          id: "c5", name: "Registration Desk", required_workers: 4, wage: 1000, sort_order: 1,
          booked: 0, available: 4, pending: 0,
          positions: [
            { id: "p13", position_number: 1, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
            { id: "p14", position_number: 2, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
            { id: "p15", position_number: 3, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
            { id: "p16", position_number: 4, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
          ],
          applicants: [
            { id: "a11", worker_id: "w11", status: "PENDING", applied_at: new Date(now.getTime() - 7200000).toISOString(), worker_note: "1 year event exp.", employer_note: null, worker: { name: "Kavitha R.", avatar_url: null } } as ApplicantRow,
            { id: "a12", worker_id: "w12", status: "PENDING", applied_at: new Date(now.getTime() - 5400000).toISOString(), worker_note: null, employer_note: null, worker: { name: "Nikhil B.", avatar_url: null } } as ApplicantRow,
          ],
        },
        {
          id: "c6", name: "Stage Management", required_workers: 2, wage: 1300, sort_order: 2,
          booked: 0, available: 2, pending: 0,
          positions: [
            { id: "p17", position_number: 1, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
            { id: "p18", position_number: 2, status: "AVAILABLE", worker_id: null, application_id: null, lock_expires_at: null, worker: null },
          ],
          applicants: [],
        },
      ],
      totalPositions: 6,
      filledPositions: 0,
    },
  ];
}

// ─── Supabase data fetching ────────────────────────────────────────────────────

async function fetchEmployerJobs(employerId: string): Promise<JobRow[]> {
  const supabase = getSupabase();
  if (!supabase) return buildMockData();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: jobs, error } = await (supabase as any)
      .from("jobs")
      .select(`
        id, job_title, venue_name, area, city, job_date, start_time, end_time,
        status, is_rapid_job, rapid_job_expires_at,
        job_categories (
          id, name, required_workers, wage, sort_order,
          job_positions (
            id, position_number, status, worker_id, application_id, lock_expires_at,
            worker:public_profiles!job_positions_worker_id_fkey ( name, avatar_url )
          ),
          applications (
            id, worker_id, status, applied_at, worker_note, employer_note,
            worker:public_profiles!applications_worker_id_fkey ( name, avatar_url )
          )
        )
      `)
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false });

    if (error || !jobs) return buildMockData();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (jobs as any[]).map((job) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categories: CategoryRow[] = ((job.job_categories ?? []) as any[])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((cat: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const positions: PositionRow[] = (cat.job_positions ?? []) as any[];
          const booked = positions.filter((p) => p.status === "BOOKED").length;
          const available = positions.filter((p) => p.status === "AVAILABLE").length;
          const pending = positions.filter((p) => p.status === "PENDING").length;
          return {
            id: cat.id,
            name: cat.name,
            required_workers: cat.required_workers,
            wage: cat.wage,
            sort_order: cat.sort_order,
            booked,
            available,
            pending,
            positions: positions.sort((a, b) => a.position_number - b.position_number),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            applicants: (cat.applications ?? []) as any[],
          };
        });

      const totalPositions = categories.reduce((s, c) => s + c.required_workers, 0);
      const filledPositions = categories.reduce((s, c) => s + c.booked, 0);

      return {
        id: job.id,
        job_title: job.job_title,
        venue_name: job.venue_name,
        area: job.area,
        city: job.city,
        job_date: job.job_date,
        start_time: (job.start_time as string).slice(0, 5),
        end_time: (job.end_time as string).slice(0, 5),
        status: job.status as DBJobStatus,
        is_rapid_job: job.is_rapid_job,
        rapid_job_expires_at: job.rapid_job_expires_at,
        categories,
        totalPositions,
        filledPositions,
      };
    });
  } catch {
    return buildMockData();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const dh = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  return `${dh}:${String(m!).padStart(2, "0")} ${suffix}`;
}

const TODAY = new Date().toISOString().split("T")[0]!;
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]!; })();

function fmtDate(iso: string): string {
  if (iso === TODAY) return "Today";
  if (iso === TOMORROW) return "Tomorrow";
  const d = new Date(iso + "T00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function posLabel(n: number, total: number): string {
  const digits = total >= 100 ? 3 : 2;
  return String(n).padStart(digits, "0");
}

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusCfg {
  label: string;
  dot: string;
  badge: string;
  Icon: typeof CheckCircle2;
}

const STATUS_CFG: Record<DBJobStatus, StatusCfg> = {
  Open:            { label: "Live",            dot: "bg-primary",     badge: "border-primary/30 bg-primary/10 text-primary",                               Icon: Clock       },
  PartiallyFilled: { label: "Partial",         dot: "bg-amber-500",   badge: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",      Icon: Users       },
  FullyFilled:     { label: "Fully Filled",    dot: "bg-success",     badge: "border-success/30 bg-success/10 text-success",                               Icon: CheckCircle2 },
  Completed:       { label: "Completed",       dot: "bg-muted-foreground", badge: "border-border bg-muted text-muted-foreground",                          Icon: BadgeCheck  },
  Cancelled:       { label: "Cancelled",       dot: "bg-destructive", badge: "border-destructive/30 bg-destructive/10 text-destructive",                    Icon: XCircle     },
};

const POS_CFG: Record<PositionStatus, { label: string; badge: string; dot: string }> = {
  AVAILABLE: { label: "Available", badge: "border-success/35 bg-success/8 text-success",               dot: "bg-success"           },
  PENDING:   { label: "On Hold",   badge: "border-amber-500/35 bg-amber-500/8 text-amber-500",         dot: "bg-amber-500 animate-pulse" },
  BOOKED:    { label: "Booked",    badge: "border-primary/30 bg-primary/10 text-primary",               dot: "bg-primary"           },
  CANCELLED: { label: "Cancelled", badge: "border-border bg-muted text-muted-foreground",               dot: "bg-muted-foreground"  },
};

const APP_STATUS_CFG: Record<AppStatus, { label: string; badge: string }> = {
  PENDING:   { label: "Pending",   badge: "border-amber-500/35 bg-amber-500/8 text-amber-600 dark:text-amber-400" },
  ACCEPTED:  { label: "Accepted",  badge: "border-success/35 bg-success/8 text-success"                           },
  REJECTED:  { label: "Rejected",  badge: "border-destructive/30 bg-destructive/8 text-destructive"               },
  CANCELLED: { label: "Cancelled", badge: "border-border bg-muted text-muted-foreground"                          },
  COMPLETED: { label: "Completed", badge: "border-border bg-muted text-muted-foreground"                          },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DBJobStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${cfg.badge}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const color = pct === 100 ? "bg-success" : pct >= 60 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Position tile (inside manage panel) ──────────────────────────────────────

function PositionTile({ pos, total }: { pos: PositionRow; total: number }) {
  const cfg = POS_CFG[pos.status];
  const label = posLabel(pos.position_number, total);

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 min-w-[76px] text-center ${
        pos.status === "BOOKED"
          ? "border-primary/25 bg-primary/[0.05]"
          : pos.status === "PENDING"
            ? "border-amber-500/30 bg-amber-500/[0.05]"
            : pos.status === "AVAILABLE"
              ? "border-success/30 bg-success/[0.05]"
              : "border-border/40 bg-muted/20 opacity-50"
      }`}
    >
      <span className="font-display text-lg font-bold leading-none">{label}</span>
      <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
        pos.status === "BOOKED" ? "text-primary/70"
          : pos.status === "PENDING" ? "text-amber-500/80"
          : pos.status === "AVAILABLE" ? "text-success/70"
          : "text-muted-foreground/40"
      }`}>{cfg.label}</span>
      {pos.worker?.name && (
        <span className="mt-1.5 text-[10px] font-medium text-muted-foreground truncate max-w-[72px]">
          {pos.worker.name.split(" ")[0]}
        </span>
      )}
    </div>
  );
}

// ─── Applicant row ─────────────────────────────────────────────────────────────

function ApplicantRow({
  app,
  jobId,
  enterDelay,
  isMock,
  onStatusChange,
}: {
  app: ApplicantRow;
  jobId: string;
  enterDelay: number;
  isMock: boolean;
  onStatusChange: (appId: string, status: AppStatus) => void;
}) {
  const [acting, setActing] = useState(false);
  const statusCfg = APP_STATUS_CFG[app.status];

  async function handleAccept() {
    setActing(true);
    if (!isMock) {
      const res = await ApplicationService.updateApplicationStatus(app.id, "ACCEPTED");
      if (!res.success) { toast.error("Failed to accept application"); setActing(false); return; }
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
    toast.success(`${app.worker?.name ?? "Applicant"} accepted!`);
    onStatusChange(app.id, "ACCEPTED");
    setActing(false);
  }

  async function handleReject() {
    setActing(true);
    if (!isMock) {
      const res = await ApplicationService.updateApplicationStatus(app.id, "REJECTED");
      if (!res.success) { toast.error("Failed to reject application"); setActing(false); return; }
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
    onStatusChange(app.id, "REJECTED");
    setActing(false);
  }

  const workerInitials = initials(app.worker?.name);
  const timeAgo = (() => {
    const diff = Math.round((Date.now() - new Date(app.applied_at).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
    return `${Math.round(diff / 1440)}d ago`;
  })();

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 transition-all duration-200 hover:border-primary/20 hover:bg-card"
      style={{
        animation: `card-enter 0.35s cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
    >
      {/* Avatar */}
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-primary-foreground ${
          app.status === "ACCEPTED" ? "bg-success" : "bg-primary/80"
        }`}
      >
        {workerInitials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm truncate">{app.worker?.name ?? "Unknown worker"}</p>
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusCfg.badge}`}>
            {statusCfg.label}
          </span>
        </div>
        {app.position_number !== undefined && (
          <p className="mt-0.5 text-xs text-muted-foreground">Position {posLabel(app.position_number, 99)}</p>
        )}
        {app.worker_note && (
          <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">"{app.worker_note}"</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo}</p>
      </div>

      {/* Actions */}
      {app.status === "PENDING" && (
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button
            id={`accept-${app.id}`}
            size="sm"
            disabled={acting}
            onClick={handleAccept}
            className="h-8 px-3 text-xs font-bold bg-success text-success-foreground hover:bg-success/90 border-0"
          >
            {acting ? <Loader2 className="size-3 animate-spin" /> : "Accept"}
          </Button>
          <Button
            id={`reject-${app.id}`}
            variant="outline"
            size="sm"
            disabled={acting}
            onClick={handleReject}
            className="h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/8"
          >
            Reject
          </Button>
        </div>
      )}
      {app.status === "ACCEPTED" && (
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs shrink-0" asChild>
          <Link to="/hire/$jobId" params={{ jobId }}>
            <User className="size-3" />
            Profile
          </Link>
        </Button>
      )}
    </div>
  );
}

// ─── Category section (expandable accordion) ──────────────────────────────────

function CategorySection({
  cat,
  job,
  defaultOpen,
  isMock,
  onApplicationStatusChange,
}: {
  cat: CategoryRow;
  job: JobRow;
  defaultOpen: boolean;
  isMock: boolean;
  onApplicationStatusChange: (catId: string, appId: string, status: AppStatus) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [applicants, setApplicants] = useState(cat.applicants);
  const contentRef = useRef<HTMLDivElement>(null);

  const pct = cat.required_workers > 0
    ? Math.round((cat.booked / cat.required_workers) * 100)
    : 0;

  function handleStatusChange(appId: string, status: AppStatus) {
    setApplicants((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    onApplicationStatusChange(cat.id, appId, status);
  }

  const pendingCount = applicants.filter((a) => a.status === "PENDING").length;
  const activePositions = cat.positions.filter((p) => p.status !== "CANCELLED");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}
      >
        {/* Category name + fill */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-sm">{cat.name}</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-2.5" />
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <FillBar filled={cat.booked} total={cat.required_workers} />
            </div>
            <span className={`shrink-0 text-xs font-bold tabular-nums ${
              pct === 100 ? "text-success" : pct > 0 ? "text-amber-500" : "text-muted-foreground"
            }`}>
              {cat.booked} / {cat.required_workers}
            </span>
          </div>
        </div>

        {/* Wage */}
        <span className="shrink-0 font-display text-sm font-bold text-primary">
          ₹{cat.wage.toLocaleString("en-IN")}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`shrink-0 size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Expandable content */}
      <div
        ref={contentRef}
        style={{
          overflow: "hidden",
          maxHeight: open ? "2000px" : "0",
          opacity: open ? 1 : 0,
          transition: open
            ? "max-height 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease"
            : "max-height 0.28s cubic-bezier(0.4,0,1,1), opacity 0.2s ease",
        }}
      >
        <div className="border-t border-border px-5 pb-5 pt-4">
          {/* Positions grid */}
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
            Work Positions
          </p>
          <div className="flex flex-wrap gap-2.5">
            {activePositions.map((pos) => (
              <PositionTile key={pos.id} pos={pos} total={cat.required_workers} />
            ))}
          </div>

          {/* Applicants */}
          {applicants.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                Applicants ({applicants.length})
              </p>
              <div className="space-y-2.5">
                {applicants.map((app, i) => (
                  <ApplicantRow
                    key={app.id}
                    app={app}
                    jobId={job.id}
                    enterDelay={i * 50}
                    isMock={isMock}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}

          {applicants.length === 0 && cat.available > 0 && (
            <p className="mt-4 text-xs text-muted-foreground/60">
              No applicants yet for {cat.available} open position{cat.available > 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  enterDelay,
  isMock,
  onUpdate,
}: {
  job: JobRow;
  enterDelay: number;
  isMock: boolean;
  onUpdate: (jobId: string, catId: string, appId: string, status: AppStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CFG[job.status];
  const fillPct = job.totalPositions > 0
    ? Math.round((job.filledPositions / job.totalPositions) * 100)
    : 0;
  const totalPending = job.categories.reduce(
    (s, c) => s + c.applicants.filter((a) => a.status === "PENDING").length,
    0
  );

  return (
    <article
      className="overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:border-primary/20 hover:shadow-lift"
      style={{ animation: `card-enter 0.4s cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both` }}
    >
      {/* Card header */}
      <div className={`p-5 ${job.is_rapid_job ? "bg-gradient-to-br from-orange-500/5 via-transparent to-transparent" : ""}`}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {job.is_rapid_job && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500/50 bg-orange-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                  <Zap className="size-2.5 fill-current" aria-hidden="true" />
                  Rapid
                </span>
              )}
              <StatusBadge status={job.status} />
              {totalPending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/8 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-2.5" />
                  {totalPending} pending
                </span>
              )}
            </div>
            <h2 className="mt-2 font-display text-lg font-bold leading-snug">{job.job_title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {job.venue_name}, {job.area}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                {fmtDate(job.job_date)} · {fmt12(job.start_time)} – {fmt12(job.end_time)}
              </span>
            </div>
          </div>
        </div>

        {/* Overall fill progress */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              Overall filled
            </span>
            <span className={`font-display font-bold tabular-nums text-sm ${
              fillPct === 100 ? "text-success" : fillPct > 0 ? "text-amber-500" : "text-muted-foreground"
            }`}>
              {job.filledPositions} / {job.totalPositions}
            </span>
          </div>
          <FillBar filled={job.filledPositions} total={job.totalPositions} />
        </div>

        {/* Category summary pills */}
        <div className="mt-4 space-y-2">
          {job.categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{cat.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <div className="w-16">
                  <FillBar filled={cat.booked} total={cat.required_workers} />
                </div>
                <span className={`w-10 text-right font-semibold tabular-nums ${
                  cat.booked === cat.required_workers ? "text-success" : "text-foreground"
                }`}>
                  {cat.booked}/{cat.required_workers}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expand / collapse manage panel */}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          id={`manage-${job.id}`}
          className="flex w-full items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-2">
            <Settings2 className="size-4" aria-hidden="true" />
            Manage Job
          </span>
          <ChevronRight
            className={`size-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Manage panel */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: expanded ? "3000px" : "0",
          opacity: expanded ? 1 : 0,
          transition: expanded
            ? "max-height 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease"
            : "max-height 0.32s cubic-bezier(0.4,0,1,1), opacity 0.2s ease",
        }}
      >
        <div className="border-t border-border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold">Categories &amp; Positions</h3>
            <Button variant="outline" size="sm" asChild>
              <Link to="/hire/$jobId" params={{ jobId: job.id }}>
                <Layers className="size-3.5" aria-hidden="true" />
                Full View
              </Link>
            </Button>
          </div>
          {job.categories.map((cat, i) => (
            <CategorySection
              key={cat.id}
              cat={cat}
              job={job}
              defaultOpen={i === 0}
              isMock={isMock}
              onApplicationStatusChange={(catId, appId, status) =>
                onUpdate(job.id, catId, appId, status)
              }
            />
          ))}
        </div>
      </div>
    </article>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { key: TabFilter; label: string }[] = [
  { key: "All",            label: "All"          },
  { key: "Live",           label: "Live"          },
  { key: "Rapid",          label: "Rapid ⚡"       },
  { key: "PartiallyFilled",label: "Partial"       },
  { key: "FullyFilled",    label: "Filled"        },
  { key: "Completed",      label: "Completed"     },
  { key: "Cancelled",      label: "Cancelled"     },
];

function matchesTab(job: JobRow, tab: TabFilter): boolean {
  if (tab === "All") return true;
  if (tab === "Rapid") return job.is_rapid_job && (job.status === "Open" || job.status === "PartiallyFilled");
  if (tab === "Live") return job.status === "Open" || job.status === "PartiallyFilled";
  return job.status === tab;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function MyJobsPage() {
  const { user, isLoggedIn, openLoginModal } = useAuth();

  const [tab, setTab] = useState<TabFilter>("All");
  const tabsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isMock = !user?.id;

  // Fetch employer's full jobs data (including categories, positions, and applicants) using React Query
  const { data: employerJobs, isLoading: loading, error, refetch } = useQuery<JobRow[], Error>({
    queryKey: ["employer-jobs", user?.id || ""],
    queryFn: async () => {
      if (!user?.id) return buildMockData();
      return fetchEmployerJobs(user.id);
    },
    enabled: !!user?.id,
  });

  const jobs = employerJobs ?? (isMock ? buildMockData() : []);

  // ── Optimistic application status update ──────────────────────────────────
  const handleAppUpdate = useCallback(
    (jobId: string, _catId: string, appId: string, status: AppStatus) => {
      queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
      refetch();
      toast.success("Application status updated");
    },
    [queryClient, refetch],
  );

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Briefcase className="size-8" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Sign in to manage your jobs</h1>
        <p className="mt-2 text-muted-foreground">
          Post jobs, review applicants, and track positions — all in one place.
        </p>
        <Button variant="hero" size="lg" className="mt-6" onClick={() => openLoginModal()}>
          Sign in to continue
        </Button>
      </div>
    );
  }

  const filtered = jobs.filter((j) => matchesTab(j, tab));
  const tabCounts = Object.fromEntries(
    TABS.map(({ key }) => [key, jobs.filter((j) => matchesTab(j, key)).length]),
  ) as Record<TabFilter, number>;

  const totalPending = jobs.reduce(
    (s: number, j: JobRow) =>
      s +
      (j.categories?.reduce(
        (cs: number, c: CategoryRow) =>
          cs + (c.applicants?.filter((a: ApplicantRow) => a.status === "PENDING").length ?? 0),
        0,
      ) ?? 0),
    0,
  );

  return (
    <div className="min-h-screen">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Employer Dashboard
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">My Jobs</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} posted
                {totalPending > 0 && (
                  <> · <span className="font-semibold text-amber-600 dark:text-amber-400">{totalPending} pending application{totalPending !== 1 ? "s" : ""}</span></>
                )}
              </p>
              {isMock && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/8 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  <AlertCircle className="size-3" />
                  Preview mode — connect Supabase for live data
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await refetch();
                  toast.success("Refreshed");
                }}
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/post-job">
                  <Plus className="size-4" aria-hidden="true" />
                  Post Job
                </Link>
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: "Total",    value: jobs.length,                                                     color: "text-foreground"  },
              { label: "Live",     value: jobs.filter((j) => j.status === "Open" || j.status === "PartiallyFilled").length, color: "text-primary" },
              { label: "Rapid",    value: jobs.filter((j) => j.is_rapid_job).length,                       color: "text-orange-500"  },
              { label: "Filled",   value: jobs.filter((j) => j.status === "FullyFilled").length,           color: "text-success"     },
              { label: "Done",     value: jobs.filter((j) => j.status === "Completed").length,             color: "text-muted-foreground" },
              { label: "Pending",  value: totalPending,                                                    color: "text-amber-600"   },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
                <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div
            ref={tabsRef}
            className="flex gap-1 overflow-x-auto py-3"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
          >
            {TABS.map(({ key, label }) => {
              const count = tabCounts[key] ?? 0;
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Job list ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
        {loading ? (
          <JobListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyJobState tab={tab} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {filtered.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                enterDelay={i * 60}
                isMock={isMock}
                onUpdate={handleAppUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function JobListSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-3xl border border-border bg-card p-5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex gap-2">
            <div className="h-5 w-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="mt-3 h-6 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 flex gap-3">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-muted" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between gap-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-8 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-10 animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyJobState({ tab }: { tab: TabFilter }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-muted/20 py-16 text-center">
      <Briefcase className="size-12 text-muted-foreground/30" />
      <h2 className="mt-4 text-lg font-semibold">
        {tab === "All" ? "No jobs posted yet" : `No ${tab.toLowerCase().replace("partiallyfilled", "partially filled").replace("fullyfilled", "filled")} jobs`}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {tab === "All"
          ? "Start by posting your first job to find verified workers."
          : "No jobs match this filter right now."}
      </p>
      {tab === "All" && (
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/post-job">
            <Plus className="size-4" />
            Post Your First Job
          </Link>
        </Button>
      )}
    </div>
  );
}
