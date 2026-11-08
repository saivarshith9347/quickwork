/**
 * Work Position Selection Screen
 * Route: /work/$jobId/positions
 *
 * Cinema-seat-selection inspired UX — adapted uniquely for WORK POSITIONS.
 * Workers browse categories via scrollable tabs, pick exactly ONE position,
 * then proceed to /checkout.
 *
 * Animations (pure CSS — no Framer Motion):
 *  - pos-enter: staggered tile entrance per category switch
 *  - available-glow: ambient pulse on available tiles
 *  - bar-rise: bottom bar entrance when position selected
 *  - panel-enter: category panel slide-in
 *  - All respect prefers-reduced-motion (global CSS override in styles.css)
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { useAuth } from "@/lib/auth-context";
import {
  type CategoryPositionStats,
  type JobPositionStats,
  type PositionStatus,
  type PositionSubscription,
  getJobPositionStats,
  subscribeToJobPositions,
  broadcastPositionUpdate,
} from "@/lib/position-service";
import { getSupabase } from "@/lib/supabase";
import { ApplicationService } from "@/lib/services/application-service";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/work/$jobId/positions")({
  validateSearch: (search: Record<string, unknown>): { cat?: string } => {
    const cat = typeof search["cat"] === "string" ? search["cat"] : undefined;
    return cat !== undefined ? { cat } : {};
  },
  head: () => ({
    meta: [
      { title: "Select Work Position — QuickWork" },
      {
        name: "description",
        content:
          "Pick your work position for this shift. One position per worker. Live availability updates.",
      },
    ],
  }),
  component: PositionSelectionPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobMeta {
  jobTitle: string;
  venueName: string;
  area: string;
  city: string;
  jobDate: string;
  startTime: string;
  endTime: string;
  isRapidJob: boolean;
  rapidJobExpiresAt: string | null;
  status: string;
}

interface Selection {
  categoryId: string;
  categoryName: string;
  positionId: string;
  positionNumber: number;
  wage: number;
  lockExpiresAt: string | null;
}

// ─── Date / time helpers ──────────────────────────────────────────────────────

const TODAY_ISO = new Date().toISOString().split("T")[0]!;
const TOMORROW_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
})();

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const dh = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  return `${dh}:${String(m!).padStart(2, "0")} ${suffix}`;
}

function formatDateLabel(isoDate: string, start: string, end: string): string {
  let day: string;
  if (isoDate === TODAY_ISO) day = "Today";
  else if (isoDate === TOMORROW_ISO) day = "Tomorrow";
  else {
    const d = new Date(isoDate + "T00:00");
    day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  return `${day} · ${fmt12(start)} – ${fmt12(end)}`;
}

function posLabel(n: number, total: number): string {
  const digits = total >= 100 ? 3 : 2;
  return String(n).padStart(digits, "0");
}

// ─── Mock data (graceful fallback when Supabase not connected) ────────────────

function makeMockStats(jobId: string): JobPositionStats {
  const cats: CategoryPositionStats[] = [
    {
      category_id: "cat-1",
      category_name: "Food Serving",
      required_workers: 5,
      total: 5,
      available: 5,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 5,
      positions: [
        { id: "p1", position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p2", position_number: 2, status: "AVAILABLE", locked_until: null },
        { id: "p3", position_number: 3, status: "AVAILABLE", locked_until: null },
        { id: "p4", position_number: 4, status: "AVAILABLE", locked_until: null },
        { id: "p5", position_number: 5, status: "AVAILABLE", locked_until: null },
      ],
    },
    {
      category_id: "cat-2",
      category_name: "Liquor Serving",
      required_workers: 4,
      total: 4,
      available: 3,
      pending: 1,
      pending_live: 1,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 4,
      positions: [
        { id: "p6", position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p7", position_number: 2, status: "AVAILABLE", locked_until: null },
        { id: "p8", position_number: 3, status: "PENDING",   locked_until: new Date(Date.now() + 90_000).toISOString() },
        { id: "p9", position_number: 4, status: "AVAILABLE", locked_until: null },
      ],
    },
    {
      category_id: "cat-3",
      category_name: "Starters Serving",
      required_workers: 3,
      total: 3,
      available: 3,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 3,
      positions: [
        { id: "p10", position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p11", position_number: 2, status: "AVAILABLE", locked_until: null },
        { id: "p12", position_number: 3, status: "AVAILABLE", locked_until: null },
      ],
    },
    {
      category_id: "cat-4",
      category_name: "Juice Serving",
      required_workers: 2,
      total: 2,
      available: 2,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 2,
      positions: [
        { id: "p13", position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p14", position_number: 2, status: "AVAILABLE", locked_until: null },
      ],
    },
  ];
  return {
    job_id: jobId,
    total: 14,
    available: 13,
    pending: 1,
    booked: 0,
    cancelled: 0,
    active: 14,
    categories: cats,
  };
}

function buildMockJobMeta(): JobMeta {
  const now = Date.now();
  const start = new Date(now + (47 * 60 + 32) * 1000);
  const startStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const end = new Date(now + (47 * 60 + 32 + 4 * 3600) * 1000);
  const endStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

  return {
    jobTitle: "Banquet Server",
    venueName: "Grand Sapphire Banquets",
    area: "Gachibowli",
    city: "Hyderabad",
    jobDate: TODAY_ISO,
    startTime: startStr,
    endTime: endStr,
    isRapidJob: true,
    rapidJobExpiresAt: start.toISOString(),
    status: "Open",
  };
}

const MOCK_JOB_META: JobMeta = buildMockJobMeta();

const MOCK_WAGES: Record<string, number> = {
  "cat-1": 1500,
  "cat-2": 1500,
  "cat-3": 1500,
  "cat-4": 1500,
};

// ─── RPC wrappers ─────────────────────────────────────────────────────────────

async function rpcReservePosition(
  positionId: string,
): Promise<{ ok: boolean; lockExpiresAt: string | null; error: string | null }> {
  const result = await ApplicationService.reservePosition({ positionId });
  if (!result.success) {
    return { ok: false, lockExpiresAt: null, error: result.error };
  }
  return { ok: true, lockExpiresAt: result.lockExpiresAt, error: null };
}

async function rpcReleasePosition(
  positionId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const result = await ApplicationService.releasePosition(positionId);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  return { ok: true, error: null };
}

// ─── Lock countdown ───────────────────────────────────────────────────────────

function LockCountdown({ expiresAt }: { expiresAt: string }) {
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
  const isUrgent = secs <= 30;

  return (
    <span
      className={`font-display font-bold tabular-nums text-sm ${
        isUrgent ? "text-destructive animate-pulse" : "text-primary"
      }`}
    >
      {mins}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ─── Position Tile ────────────────────────────────────────────────────────────

type TileVariant = "available" | "selected" | "pending" | "booked";

function tileVariant(status: PositionStatus, isSelected: boolean): TileVariant {
  if (isSelected) return "selected";
  if (status === "AVAILABLE") return "available";
  if (status === "PENDING") return "pending";
  return "booked";
}

function PositionTile({
  positionId,
  positionNumber,
  status,
  isSelected,
  totalInCategory,
  onClick,
  enterDelay,
}: {
  positionId: string;
  positionNumber: number;
  status: PositionStatus;
  isSelected: boolean;
  totalInCategory: number;
  onClick: (id: string) => void;
  enterDelay: number;
}) {
  const variant = tileVariant(status, isSelected);
  const isInteractable = variant === "available" || variant === "selected";
  const label = posLabel(positionNumber, totalInCategory);

  return (
    <button
      type="button"
      id={`position-tile-${positionId}`}
      aria-label={`Position ${label} — ${variant}`}
      aria-pressed={isSelected}
      aria-disabled={!isInteractable}
      disabled={!isInteractable}
      onClick={() => isInteractable && onClick(positionId)}
      style={{ animationDelay: `${enterDelay}ms`, animationFillMode: "both" }}
      className={[
        "relative flex flex-col items-center justify-center rounded-2xl border-2 select-none",
        "h-[80px] w-full sm:h-[88px]",
        "animate-[pos-enter_0.35s_cubic-bezier(0.22,1,0.36,1)_both]",
        "transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "available" &&
          "border-success/50 bg-success/[0.06] text-success cursor-pointer " +
          "hover:border-success hover:bg-success/[0.12] hover:scale-[1.05] " +
          "hover:shadow-[0_0_18px_color-mix(in_oklab,var(--color-success)_28%,transparent)] " +
          "active:scale-[0.98]",
        variant === "selected" &&
          "border-primary bg-primary text-primary-foreground cursor-pointer " +
          "scale-[1.05] shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_25%,transparent),0_4px_20px_color-mix(in_oklab,var(--color-primary)_30%,transparent)]",
        variant === "pending" &&
          "border-gold/50 bg-gold/[0.08] text-gold-foreground cursor-not-allowed opacity-80",
        variant === "booked" &&
          "border-border/40 bg-muted/30 text-muted-foreground/40 cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Position number */}
      <span className="font-display text-xl font-bold leading-none tracking-tight">
        {label}
      </span>

      {/* Status sublabel */}
      <span
        className={`mt-1.5 text-[9px] font-bold uppercase tracking-[0.15em] ${
          variant === "selected"
            ? "text-primary-foreground/75"
            : variant === "available"
              ? "text-success/65"
              : variant === "pending"
                ? "text-gold-foreground/65"
                : "text-muted-foreground/35"
        }`}
      >
        {variant === "selected"
          ? "Selected"
          : variant === "pending"
            ? "On Hold"
            : variant === "booked"
              ? "Booked"
              : "Available"}
      </span>

      {/* Selected check badge */}
      {isSelected && (
        <div className="absolute -right-1.5 -top-1.5 flex size-[22px] items-center justify-center rounded-full bg-primary-foreground shadow-md">
          <CheckCircle2 className="size-[14px] text-primary" strokeWidth={3} aria-hidden="true" />
        </div>
      )}

      {/* Pending live dot */}
      {variant === "pending" && (
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-gold animate-pulse" />
      )}
    </button>
  );
}

// ─── Category Tab ─────────────────────────────────────────────────────────────

function CategoryTab({
  cat,
  isActive,
  hasSelection,
  onClick,
}: {
  cat: CategoryPositionStats;
  isActive: boolean;
  hasSelection: boolean;
  onClick: () => void;
}) {
  const isFull = cat.available === 0;
  const isLow = cat.available > 0 && cat.available <= 2;

  return (
    <button
      type="button"
      id={`cat-tab-${cat.category_id}`}
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={[
        "relative shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-primary text-primary-foreground shadow-brand"
          : "border border-border bg-card/80 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-card",
      ].join(" ")}
    >
      {hasSelection && !isActive && (
        <span className="size-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
      )}
      <span>{cat.category_name}</span>
      <span
        className={`rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${
          isActive
            ? "bg-primary-foreground/20 text-primary-foreground"
            : isFull
              ? "bg-muted text-muted-foreground"
              : isLow
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-success/15 text-success"
        }`}
      >
        {isFull ? "Full" : cat.available}
      </span>
    </button>
  );
}

// ─── Booking Legend ───────────────────────────────────────────────────────────

function BookingLegend() {
  const items: { variant: TileVariant; label: string }[] = [
    { variant: "available", label: "Available" },
    { variant: "selected",  label: "Selected"  },
    { variant: "pending",   label: "On Hold"   },
    { variant: "booked",    label: "Booked"    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
      {items.map(({ variant, label }) => (
        <div key={variant} className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className={`relative h-[18px] w-7 rounded-md border-2 ${
              variant === "available"
                ? "border-success/55 bg-success/[0.08]"
                : variant === "selected"
                  ? "border-primary bg-primary"
                  : variant === "pending"
                    ? "border-gold/55 bg-gold/[0.08]"
                    : "border-border/40 bg-muted/30"
            }`}
          >
            {variant === "pending" && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-gold" />
            )}
            {variant === "selected" && (
              <span className="absolute -right-0.5 -top-0.5 flex size-[10px] items-center justify-center rounded-full bg-primary-foreground">
                <CheckCircle2 className="size-[6px] text-primary" strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PositionSelectionPage() {
  const { jobId } = Route.useParams();
  const searchParams = Route.useSearch();
  const requestedCatId = searchParams?.cat;
  const navigate = useNavigate();
  const { isLoggedIn, openLoginModal, user } = useAuth();

  // Data
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [jobMeta, setJobMeta] = useState<JobMeta | null>(null);
  const [stats, setStats] = useState<JobPositionStats | null>(null);
  const [wages, setWages] = useState<Record<string, number>>({});
  const [dataError, setDataError] = useState<string | null>(null);
  const [isRapidCutoff, setIsRapidCutoff] = useState(false);

  // UI state
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lostPosition, setLostPosition] = useState<{
    id: string;
    categoryName: string;
    positionNumber: number;
  } | null>(null);
  const [reserving, setReserving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  // Bumped on every category switch — remounts grid and replays entrance animations
  const [panelKey, setPanelKey] = useState(0);

  const tabsRef = useRef<HTMLDivElement>(null);
  const currentWorkerId = user?.id ?? null;

  // Refs for real-time subscription callback to prevent re-subscribing on state change (memory leak prevention)
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const currentWorkerIdRef = useRef(currentWorkerId);
  currentWorkerIdRef.current = currentWorkerId;

  // ── Load job meta ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const client = getSupabase();
      if (!client) {
        const mockStats = makeMockStats(jobId);
        const chosenCat =
          requestedCatId && mockStats.categories.some((c) => c.category_id === requestedCatId)
            ? requestedCatId
            : "cat-1";
        setJobMeta(MOCK_JOB_META);
        setWages(MOCK_WAGES);
        setStats(mockStats);
        setActiveCategoryId(chosenCat);
        setIsMock(true);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobRow, error: jobError } = await (client as any)
        .from("jobs")
        .select(
          "job_title, venue_name, area, city, job_date, start_time, end_time, is_rapid_job, rapid_job_expires_at, status, job_categories(id, wage)",
        )
        .eq("id", jobId)
        .single();

      if (cancelled) return;

      if (jobError || !jobRow) {
        const mockStats = makeMockStats(jobId);
        const chosenCat =
          requestedCatId && mockStats.categories.some((c) => c.category_id === requestedCatId)
            ? requestedCatId
            : "cat-1";
        setJobMeta(MOCK_JOB_META);
        setWages(MOCK_WAGES);
        setStats(mockStats);
        setActiveCategoryId(chosenCat);
        setIsMock(true);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = jobRow as any;
      setJobMeta({
        jobTitle: r.job_title,
        venueName: r.venue_name,
        area: r.area,
        city: r.city,
        jobDate: r.job_date,
        startTime: (r.start_time as string).slice(0, 5),
        endTime: (r.end_time as string).slice(0, 5),
        isRapidJob: r.is_rapid_job,
        rapidJobExpiresAt: r.rapid_job_expires_at,
        status: r.status,
      });

      const wageMap: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const cat of (r.job_categories ?? []) as any[]) {
        wageMap[cat.id as string] = cat.wage as number;
      }
      setWages(wageMap);

      const statsResult = await getJobPositionStats(jobId);
      if (cancelled) return;

      if (!statsResult.ok) {
        setDataError(statsResult.error);
        setLoading(false);
        return;
      }

      setStats(statsResult.data);
      if (statsResult.data.categories.length > 0) {
        const matchingCat =
          requestedCatId &&
          statsResult.data.categories.some((c) => c.category_id === requestedCatId);
        setActiveCategoryId(
          matchingCat ? requestedCatId : statsResult.data.categories[0]!.category_id,
        );
      }
      setIsMock(false);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [jobId, requestedCatId]);

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;

    const sub = subscribeToJobPositions(jobId, ({ newRow }) => {
      if (!newRow) return;

      const posId = (newRow["id"] as string) || "";
      const newStatus = (newRow["status"] as PositionStatus) || "BOOKED";
      const newLock = (newRow["lock_expires_at"] as string | null) ?? null;
      const newWorkerId = (newRow["worker_id"] as string | null) ?? null;
      const posNum = typeof newRow["position_number"] === "number" ? newRow["position_number"] : null;
      const catId = (newRow["category_id"] as string | null) ?? null;

      // 1. Update position state and live counts without requiring full page refresh
      setStats((prev) => {
        if (!prev) return prev;
        let changed = false;

        const updatedCategories = prev.categories.map((cat) => {
          const matchesCategory = !catId || cat.category_id === catId;
          const targetPos = cat.positions.find(
            (p) => p.id === posId || (posNum != null && p.position_number === posNum && matchesCategory),
          );
          if (!targetPos) return cat;

          changed = true;
          const updatedPositions = cat.positions.map((p) => {
            const isMatch = p.id === posId || (posNum != null && p.position_number === posNum && matchesCategory);
            if (!isMatch) return p;
            return {
              ...p,
              status: newStatus,
              locked_until: newLock,
            };
          });

          return {
            ...cat,
            positions: updatedPositions,
            available: updatedPositions.filter((p) => p.status === "AVAILABLE").length,
            pending: updatedPositions.filter((p) => p.status === "PENDING").length,
            booked: updatedPositions.filter((p) => p.status === "BOOKED").length,
          };
        });

        if (!changed) return prev;

        return {
          ...prev,
          categories: updatedCategories,
          available: updatedCategories.reduce((s, c) => s + c.available, 0),
          pending: updatedCategories.reduce((s, c) => s + c.pending, 0),
          booked: updatedCategories.reduce((s, c) => s + c.booked, 0),
        };
      });

      // 2. Check if this worker had selected the position that was just booked/reserved
      const activeSelection = selectionRef.current;
      const myWorkerId = currentWorkerIdRef.current;

      if (activeSelection) {
        const isMyPos =
          activeSelection.positionId === posId ||
          (posNum != null && activeSelection.positionNumber === posNum && (!catId || activeSelection.categoryId === catId));

        if (isMyPos) {
          const isBooked = newStatus === "BOOKED";
          const isPendingByOther = newStatus === "PENDING" && newWorkerId && newWorkerId !== myWorkerId;

          if (isBooked || isPendingByOther) {
            // Automatically clear the selection
            setSelection(null);

            // Format position label with leading zero (e.g. "Position 03")
            const formattedNum = String(activeSelection.positionNumber).padStart(2, "0");
            const alertMsg = `Position ${formattedNum} was just booked by another worker.`;

            setLostPosition({
              id: activeSelection.positionId,
              categoryName: activeSelection.categoryName,
              positionNumber: activeSelection.positionNumber,
            });

            toast.warning(alertMsg, {
              duration: 6000,
            });
          }
        }
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [jobId]);

  // Simulation hook for multi-tab testing
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__simulateWorkerBooking = (targetPositionNumber = 3, catId = "cat-1") => {
      broadcastPositionUpdate(jobId, {
        id: `p${targetPositionNumber}`,
        job_id: jobId,
        status: "BOOKED",
        position_number: targetPositionNumber,
        category_id: catId,
        worker_id: "worker_other_tab",
      });
    };
    return () => {
      delete (window as any).__simulateWorkerBooking;
    };
  }, [jobId]);

  // ── Scroll active tab into view ────────────────────────────────────────────
  useEffect(() => {
    if (!activeCategoryId || !tabsRef.current) return;
    const btn = tabsRef.current.querySelector<HTMLElement>(
      `#cat-tab-${activeCategoryId}`,
    );
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategoryId]);

  // ── Position click ─────────────────────────────────────────────────────────
  const handlePositionClick = useCallback(
    async (positionId: string) => {
      if (isRapidCutoff) {
        toast.error("Applications closed", {
          description: "Shift cutoff has passed for this Rapid Job.",
        });
        return;
      }
      if (!isLoggedIn && !isMock) {
        openLoginModal({ type: "book-shift", payload: jobId });
        return;
      }
      const effectiveWorkerId = currentWorkerId ?? "worker_demo";
      if (!stats) return;

      const activeCategory = stats.categories.find(
        (c) => c.category_id === activeCategoryId,
      );
      if (!activeCategory) return;

      const clickedPosition = activeCategory.positions.find((p) => p.id === positionId);
      if (!clickedPosition) return;

      // Deselect same position
      if (selection?.positionId === positionId) {
        setReleasing(true);
        if (!isMock) await rpcReleasePosition(positionId);
        broadcastPositionUpdate(jobId, {
          id: positionId,
          job_id: jobId,
          status: "AVAILABLE",
          position_number: clickedPosition.position_number,
          category_id: activeCategoryId!,
          worker_id: null,
        });
        setSelection(null);
        setReleasing(false);
        return;
      }

      // Release previous lock before acquiring new one
      if (selection) {
        if (!isMock) {
          await rpcReleasePosition(selection.positionId);
        }
        broadcastPositionUpdate(jobId, {
          id: selection.positionId,
          job_id: jobId,
          status: "AVAILABLE",
          position_number: selection.positionNumber,
          category_id: selection.categoryId,
          worker_id: null,
        });
      }
      setSelection(null);

      setReserving(true);
      let lockExpiresAt: string | null = null;

      if (!isMock) {
        const result = await rpcReservePosition(positionId);
        if (!result.ok) {
          setReserving(false);
          const friendlyErrors: Record<string, string> = {
            position_not_found: "This position no longer exists.",
            position_locked_by_another_worker: "This position was just reserved by another worker.",
            position_already_booked: "This position is already booked.",
            job_not_accepting: "This job is no longer accepting bookings.",
            worker_already_has_active_application: "You already have an active application for this job.",
          };
          toast.error("Cannot select position", {
            description: friendlyErrors[result.error ?? ""] ?? result.error ?? "Please try again.",
          });
          const refreshed = await getJobPositionStats(jobId);
          if (refreshed.ok) setStats(refreshed.data);
          return;
        }
        lockExpiresAt = result.lockExpiresAt;
      } else {
        lockExpiresAt = new Date(Date.now() + 120_000).toISOString();
      }

      setSelection({
        categoryId: activeCategoryId!,
        categoryName: activeCategory.category_name,
        positionId,
        positionNumber: clickedPosition.position_number,
        wage: wages[activeCategoryId!] ?? 0,
        lockExpiresAt,
      });

      broadcastPositionUpdate(jobId, {
        id: positionId,
        job_id: jobId,
        status: "PENDING",
        position_number: clickedPosition.position_number,
        category_id: activeCategoryId!,
        worker_id: effectiveWorkerId,
        lock_expires_at: lockExpiresAt,
      });

      // Optimistic update in mock mode
      if (isMock) {
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: prev.categories.map((cat) => ({
              ...cat,
              positions: cat.positions.map((p) =>
                p.id === positionId
                  ? { ...p, status: "PENDING" as PositionStatus }
                  : p,
            ),
          })),
        };
      });
      }

      setReserving(false);
      setLostPosition(null);
    },
    [isLoggedIn, isMock, isRapidCutoff, openLoginModal, jobId, currentWorkerId, stats, activeCategoryId, selection, wages],
  );

  // ── Category switch ────────────────────────────────────────────────────────
  const handleCategoryChange = (catId: string) => {
    setActiveCategoryId(catId);
    setPanelKey((k) => k + 1);
    setLostPosition(null);
  };

  // ── Continue ───────────────────────────────────────────────────────────────
  const handleContinue = () => {
    if (!selection) return;
    if (isRapidCutoff) {
      toast.error("Applications closed", {
        description: "Shift cutoff has passed for this Rapid Job.",
      });
      return;
    }
    sessionStorage.setItem(
      "qw_pending_booking",
      JSON.stringify({
        positionId: selection.positionId,
        categoryId: selection.categoryId,
        categoryName: selection.categoryName,
        positionNumber: selection.positionNumber,
        wage: selection.wage,
        lockExpiresAt: selection.lockExpiresAt,
        jobId,
        jobTitle: jobMeta?.jobTitle,
        jobDate: jobMeta?.jobDate,
        startTime: jobMeta?.startTime,
        endTime: jobMeta?.endTime,
        area: jobMeta?.area,
        city: jobMeta?.city,
        venueName: jobMeta?.venueName,
        isRapidJob: jobMeta?.isRapidJob,
        rapidJobExpiresAt: jobMeta?.rapidJobExpiresAt,
      }),
    );
    void navigate({ to: "/apply/review" });
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return <PositionSelectionSkeleton />;

  // ── Error state ────────────────────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto size-12 text-destructive/60" />
        <h2 className="mt-4 text-xl font-bold">Could not load positions</h2>
        <p className="mt-2 text-sm text-muted-foreground">{dataError}</p>
        <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!stats || !jobMeta) return null;

  const activeCategory = stats.categories.find((c) => c.category_id === activeCategoryId);
  const totalAvailable = stats.available;
  const isJobFull = totalAvailable === 0;
  const isJobClosed = ["FullyFilled", "Completed", "Cancelled"].includes(jobMeta.status);

  return (
    <div className="min-h-screen pb-44 lg:pb-36">

      {/* ── Sticky top nav ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/work/$jobId" params={{ jobId }}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline text-sm">Back to details</span>
              </Link>
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <p className="hidden truncate text-sm font-semibold text-muted-foreground sm:block">
              {jobMeta.jobTitle}
            </p>
          </div>
        </div>
      </div>

      {/* ── Job header ──────────────────────────────────────────────────── */}
      <div
        className={`animate-rise border-b border-border ${
          jobMeta.isRapidJob
            ? "bg-gradient-to-br from-orange-500/8 via-transparent to-transparent"
            : "bg-surface"
        }`}
        style={{ animationFillMode: "both" }}
      >
        <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {jobMeta.isRapidJob && (
                <div className="mb-2.5">
                  <RapidJobBadge
                    jobDate={jobMeta.jobDate}
                    startTime={jobMeta.startTime}
                    endTime={jobMeta.endTime}
                    rapidJobExpiresAt={jobMeta.rapidJobExpiresAt}
                    variant="compact"
                    onCutoff={() => setIsRapidCutoff(true)}
                  />
                </div>
              )}

              <h1 className="text-2xl font-bold leading-tight sm:text-[1.75rem]">
                {jobMeta.jobTitle}
              </h1>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-[15px] shrink-0 text-muted-foreground/70" />
                  {jobMeta.area}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-[15px] shrink-0 text-muted-foreground/70" />
                  {formatDateLabel(jobMeta.jobDate, jobMeta.startTime, jobMeta.endTime)}
                </span>
              </div>
            </div>

            {/* Availability summary */}
            <div className="flex items-center divide-x divide-border rounded-xl border border-border bg-card px-1 py-1 shadow-sm">
              <div className="px-3 py-1.5 text-center">
                <p className="font-display text-xl font-bold text-success leading-none">{totalAvailable}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Open</p>
              </div>
              <div className="px-3 py-1.5 text-center">
                <p className="font-display text-xl font-bold leading-none">{stats.total}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {isMock && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Info className="size-3.5" aria-hidden="true" />
              Preview mode — connect Supabase to enable live bookings
            </div>
          )}
        </div>
      </div>

      {/* ── Rapid Cutoff Notice ────────────────────────────────────────── */}
      {isRapidCutoff && (
        <div className="mx-auto max-w-4xl px-4 pt-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Applications Closed</p>
              <p className="text-xs text-destructive/85 mt-0.5">
                Shift cutoff reached for this Rapid Job. New position reservations are closed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Job closed / full ────────────────────────────────────────────── */}
      {(isJobFull || isJobClosed) && (
        <div className="mx-auto max-w-4xl px-4 py-12 lg:px-8">
          <div className="rounded-3xl border-2 border-dashed border-border bg-muted/20 py-16 text-center">
            <Users className="mx-auto size-14 text-muted-foreground/30" />
            <h2 className="mt-5 text-xl font-bold text-muted-foreground">
              {isJobClosed ? "This job is closed" : "All positions filled"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {isJobClosed
                ? "This job is no longer accepting bookings."
                : "Every position has been booked. Check other available shifts!"}
            </p>
            <Button variant="outline" className="mt-7" asChild>
              <Link to="/work">Browse other shifts</Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {!isJobFull && !isJobClosed && (
        <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">

          {/* Category tabs */}
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">Choose a category</h2>
              <p className="text-xs text-muted-foreground">Select one position</p>
            </div>
            <div
              ref={tabsRef}
              role="tablist"
              aria-label="Work categories"
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" }}
            >
              {stats.categories.map((cat) => (
                <CategoryTab
                  key={cat.category_id}
                  cat={cat}
                  isActive={activeCategoryId === cat.category_id}
                  hasSelection={selection?.categoryId === cat.category_id}
                  onClick={() => handleCategoryChange(cat.category_id)}
                />
              ))}
            </div>
          </div>

          {/* Position panel */}
          {activeCategory && (
            <div
              key={panelKey}
              role="tabpanel"
              aria-label={`${activeCategory.category_name} positions`}
              className="animate-[panel-enter_0.3s_cubic-bezier(0.22,1,0.36,1)_both]"
            >
              {/* Category header */}
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="size-5 text-muted-foreground/50" aria-hidden="true" />
                    <h3 className="text-xl font-bold">{activeCategory.category_name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground pl-[29px]">
                    {activeCategory.available > 0
                      ? `${activeCategory.available} of ${activeCategory.required_workers} positions open`
                      : "All positions filled for this category"}
                  </p>
                </div>

                {/* Wage chip */}
                <div className="flex items-baseline gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 shadow-sm">
                  <span className="text-xs font-medium text-muted-foreground">Wage</span>
                  <span
                    className={`font-display text-xl font-bold ${
                      jobMeta.isRapidJob
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-primary"
                    }`}
                  >
                    ₹{(wages[activeCategoryId!] ?? 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">/ shift</span>
                </div>
              </div>

              {/* WORK POSITIONS separator */}
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-muted-foreground/40" aria-hidden="true" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">
                    Work Positions
                  </span>
                  <Sparkles className="size-3 text-muted-foreground/40" aria-hidden="true" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
              </div>

              {/* Tile grid — columns adapt to count */}
              <div
                className={`grid gap-3 ${
                  activeCategory.positions.length <= 3
                    ? "grid-cols-3"
                    : activeCategory.positions.length <= 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : activeCategory.positions.length <= 9
                        ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
                        : "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6"
                }`}
              >
                {activeCategory.positions
                  .filter((p) => p.status !== "CANCELLED")
                  .map((p, i) => (
                    <PositionTile
                      key={p.id}
                      positionId={p.id}
                      positionNumber={p.position_number}
                      status={p.status}
                      isSelected={selection?.positionId === p.id}
                      totalInCategory={activeCategory.required_workers}
                      onClick={handlePositionClick}
                      enterDelay={i * 45}
                    />
                  ))}
              </div>

              {/* Position sniped notice */}
              {lostPosition && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-orange-500/35 bg-orange-500/[0.06] px-4 py-3 text-sm text-orange-700 dark:text-orange-400 animate-rise">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    <strong>This position is no longer available.</strong>{" "}
                    Another worker just reserved {lostPosition.categoryName} ·{" "}
                    {posLabel(lostPosition.positionNumber, activeCategory.required_workers)}.
                    Please pick a different one.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLostPosition(null)}
                    className="ml-auto shrink-0 rounded-md p-0.5 hover:bg-orange-500/15 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {/* Loading spinner */}
              {(reserving || releasing) && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {reserving ? "Reserving position…" : "Releasing hold…"}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-12 border-t border-border pt-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
              Legend
            </p>
            <BookingLegend />
          </div>
        </div>
      )}

      {/* ── Sticky bottom booking bar ────────────────────────────────────── */}
      {selection ? (
        <div
          className={[
            "fixed bottom-0 left-0 right-0 z-30",
            "border-t-2 border-primary/25 bg-surface/98 backdrop-blur-md",
            "shadow-[0_-8px_40px_-8px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]",
            "animate-[bar-rise_0.38s_cubic-bezier(0.22,1,0.36,1)_both]",
          ].join(" ")}
        >
          <div className="mx-auto max-w-4xl px-4 py-4 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                  Selected Position
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <p className="font-display text-lg font-bold leading-tight truncate">
                    {selection.categoryName}
                    <span className="ml-2 text-base font-semibold text-muted-foreground">
                      · {posLabel(
                        selection.positionNumber,
                        stats?.categories.find((c) => c.category_id === selection.categoryId)
                          ?.required_workers ?? 99,
                      )}
                    </span>
                  </p>
                  <p
                    className={`font-display text-xl font-bold ${
                      jobMeta?.isRapidJob
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-primary"
                    }`}
                  >
                    ₹{selection.wage.toLocaleString("en-IN")}
                  </p>
                </div>
                {selection.lockExpiresAt && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Hold expires in</span>
                    <LockCountdown expiresAt={selection.lockExpiresAt} />
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={releasing}
                  onClick={async () => {
                    if (!selection) return;
                    const prevSel = selection;
                    setReleasing(true);
                    if (!isMock && currentWorkerId) await rpcReleasePosition(prevSel.positionId);
                    broadcastPositionUpdate(jobId, {
                      id: prevSel.positionId,
                      job_id: jobId,
                      status: "AVAILABLE",
                      position_number: prevSel.positionNumber,
                      category_id: prevSel.categoryId,
                      worker_id: null,
                    });
                    setSelection(null);
                    setReleasing(false);
                  }}
                  className="flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/[0.06] hover:text-destructive disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Cancel selection"
                >
                  {releasing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                </button>

                <Button
                  id="continue-booking-btn"
                  size="lg"
                  disabled={isRapidCutoff}
                  onClick={handleContinue}
                  className={`min-w-[140px] font-bold transition-all duration-200 active:scale-[0.97] ${
                    isRapidCutoff
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                      : jobMeta?.isRapidJob
                        ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-[0_4px_18px_color-mix(in_oklab,#F26B1D_38%,transparent)]"
                        : "shadow-brand hover:shadow-brand-lg"
                  }`}
                >
                  {isRapidCutoff ? "Applications Closed" : "Continue"}
                  {!isRapidCutoff && <ArrowRight className="size-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md">
          <div className="mx-auto max-w-4xl px-4 py-4 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {isRapidCutoff
                    ? "Applications closed — shift cutoff reached"
                    : isJobFull
                      ? "All positions filled"
                      : "Select one available position to continue"}
                </p>
                <p className="text-[11px] text-muted-foreground/55 mt-0.5">
                  One position per worker · wage displayed above
                </p>
              </div>
              <Button
                id="continue-booking-disabled-btn"
                variant="outline"
                size="lg"
                disabled
                className="min-w-[140px] opacity-50"
              >
                {isRapidCutoff ? "Closed" : "Continue"}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PositionSelectionSkeleton() {
  return (
    <div className="min-h-screen pb-36">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-3 lg:px-8">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>

      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-6 lg:px-8">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-4">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-8">
        <div className="flex gap-2">
          {[110, 130, 120, 105].map((w, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl bg-muted"
              style={{ width: w, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-12 w-32 animate-pulse rounded-xl bg-muted" />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[80px] animate-pulse rounded-2xl bg-muted"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-6 w-52 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-12 w-36 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
