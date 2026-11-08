import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  X,
  Zap,
  ArrowRight,
  Package,
  Loader2,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JobCardListSkeleton } from "@/components/job-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RapidJobBadge, RapidJobSpotlightCard } from "@/components/rapid-job-badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/lib/auth-context";
import { getDistanceToJob } from "@/lib/distance-utils";
import {
  JOB_CATEGORY_LABELS,
  type JobCategoryValue,
  type BaseJob,
  formatLocation,
  calculateDuration,
  toJobListing,
  type JobListing as JobListingType,
} from "@/lib/job-types";
import { useJobs } from "@/lib/hooks/use-jobs";
import { getSupabase } from "@/lib/supabase";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/work")({
  head: () => ({
    meta: [
      { title: "Find Work — QuickWork" },
      {
        name: "description",
        content:
          "Discover verified daily-wage shifts near you. Wage shown upfront — filter by category, date and location. No login needed to browse.",
      },
      { property: "og:title", content: "Find Work — QuickWork" },
      {
        property: "og:description",
        content:
          "Browse open shifts near you. Filter by category, date and pay. Book in one tap.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const TODAY_ISO = new Date().toISOString().split("T")[0]!;
const TOMORROW_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
})();

const CATEGORY_CHIPS: { id: JobCategoryValue; emoji: string }[] = [
  { id: "Hospitality", emoji: "🍽" },
  { id: "Events",      emoji: "🎪" },
  { id: "Delivery",    emoji: "🚚" },
  { id: "Retail",      emoji: "🛒" },
  { id: "Construction",emoji: "👷" },
  { id: "Warehouse",   emoji: "📦" },
  { id: "Cleaning",    emoji: "🧹" },
  { id: "Other",       emoji: "💼" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterId =
  | "rapid"
  | "today"
  | "tomorrow"
  | "verified"
  | "wage-1000"
  | "wage-1200"
  | "wage-1500";

// Extended JobListing with additional fields for job cards
interface WorkJobListing extends JobListingType {
  venueName: string;
  city: string;
  jobDate: string;
  isRapidJob: boolean;
  rapidJobExpiresAt: string | null;
  status: string;
  isVerifiedEmployer: boolean;
  minWage: number;
  maxWage: number;
  categoryNames: string[];
  totalPositions: number;
  availablePositions: number;
}

type JobListing = WorkJobListing;

// ─── Mock Data (fallback when Supabase not configured) ───────────────────────

const MOCK_JOBS: WorkJobListing[] = [
  {
    id: "mock-1",
    jobTitle: "Banquet Server - Urgent",
    category: "Hospitality",
    employer: "Grand Events",
    rating: "4.8",
    wage: 1500,
    wageDisplay: "₹1,500",
    date: TODAY_ISO,
    startTime: "18:00",
    endTime: "23:00",
    duration: 300,
    location: "Gachibowli, Hyderabad",
    area: "Gachibowli",
    distance: "2.5 km",
    facilities: ["Meals provided", "Uniform"],
    jobType: "one-time",
    description: "Urgent banquet server needed for wedding reception",
    venueName: "Grand Sapphire Banquets",
    city: "Hyderabad",
    jobDate: TODAY_ISO,
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: "Open",
    isVerifiedEmployer: true,
    minWage: 1500,
    maxWage: 1500,
    categoryNames: ["Food Serving"],
    totalPositions: 5,
    availablePositions: 3,
  },
  {
    id: "mock-2",
    jobTitle: "Warehouse Loading Staff",
    category: "Warehouse",
    employer: "Urban Logistics",
    wage: 1100,
    wageDisplay: "₹1,100",
    date: TOMORROW_ISO,
    startTime: "06:00",
    endTime: "14:00",
    duration: 480,
    location: "Uppal, Hyderabad",
    area: "Uppal",
    facilities: ["Transport"],
    jobType: "one-time",
    description: "Weekend inventory shift - must lift 20kg+",
    venueName: "Urban Logistics Hub",
    city: "Hyderabad",
    jobDate: TOMORROW_ISO,
    isRapidJob: false,
    rapidJobExpiresAt: null,
    status: "PartiallyFilled",
    isVerifiedEmployer: false,
    minWage: 1100,
    maxWage: 1100,
    categoryNames: ["Loading Crew"],
    totalPositions: 10,
    availablePositions: 6,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Transform BaseJob from service to WorkJobListing for display.
 * Handles employer verification status (simplified for now).
 */
function baseJobToJobListing(job: BaseJob): WorkJobListing {
  const baseJobListing = toJobListing(job, {
    employerName: 'Unknown Employer',
  });
  
  return {
    ...baseJobListing,
    venueName: typeof job.location === 'object' ? job.location.venueName : formatLocation(job.location, 'short'),
    city: typeof job.location === 'object' ? job.location.city : '',
    jobDate: job.date,
    isRapidJob: job.isRapidJob,
    rapidJobExpiresAt: job.rapidJobExpiresAt || null,
    status: job.status,
    isVerifiedEmployer: false, // TODO: Join with employer profile
    minWage: job.wage,
    maxWage: job.wage,
    categoryNames: [job.category],
    totalPositions: job.positionsRequired,
    availablePositions: job.positionsRemaining,
  };
}

function formatDate(isoDate: string, startTime: string): string {
  const date = new Date(isoDate + "T00:00");
  const todayStr = TODAY_ISO;
  const tomorrowStr = TOMORROW_ISO;

  let dayLabel: string;
  if (isoDate === todayStr) {
    dayLabel = "Today";
  } else if (isoDate === tomorrowStr) {
    dayLabel = "Tomorrow";
  } else {
    dayLabel = date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const [h, m] = startTime.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const displayH = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  const timeStr = `${displayH}:${String(m!).padStart(2, "0")} ${suffix}`;

  return `${dayLabel} · ${timeStr}`;
}

function wageDisplay(min: number, max: number): string {
  if (min === max || max === 0) {
    return `₹${min.toLocaleString("en-IN")}`;
  }
  return `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`;
}

function availabilityLabel(available: number, total: number, isRapid: boolean): string {
  if (total === 0) return "No positions";
  if (available === 0) return "All filled";
  if (isRapid) {
    return `${available} worker${available !== 1 ? "s" : ""} required`;
  }
  if (available === total) return `${total} positions open`;
  return `${available} / ${total} positions left`;
}

function availabilityFill(available: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(4, Math.round((available / total) * 100));
}

function categoryEmoji(cat: string): string {
  return CATEGORY_CHIPS.find((c) => c.id === cat)?.emoji ?? "💼";
}

// ─── Availability bar ─────────────────────────────────────────────────────────

function AvailabilityBar({
  available,
  total,
  isRapid,
}: {
  available: number;
  total: number;
  isRapid: boolean;
}) {
  const fill = availabilityFill(available, total);
  const isFull = available === 0;
  const isLow = available > 0 && available <= 3;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-xs font-semibold ${
            isFull
              ? "text-muted-foreground"
              : isLow || isRapid
                ? "text-orange-600 dark:text-orange-400 font-bold"
                : "text-success"
          }`}
        >
          {availabilityLabel(available, total, isRapid)}
        </span>
        {isLow && !isFull && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            Filling fast
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isFull
              ? "bg-muted-foreground/40"
              : isLow || isRapid
                ? "bg-gradient-to-r from-orange-500 to-amber-400 animate-availability-urgent"
                : "bg-gradient-to-r from-success to-emerald-400"
          }`}
          style={{ width: `${fill}%` }}
          role="progressbar"
          aria-valuenow={available}
          aria-valuemax={total}
          aria-label={`${available} of ${total} positions available`}
        />
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: JobListing;
  index: number;
}

function JobCard({ job, index }: JobCardProps) {
  const [isCutoff, setIsCutoff] = useState(false);
  const isFull = job.availablePositions === 0 && job.totalPositions > 0;
  const isClosed = isCutoff;
  const distanceInfo = getDistanceToJob(job.area);

  return (
    <Link
      to="/work/$jobId"
      params={{ jobId: job.id }}
      className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl ${
        isClosed ? "pointer-events-none opacity-60" : ""
      }`}
      style={{
        animationDelay: `${index * 55}ms`,
        animationFillMode: "both",
      }}
      aria-label={`${job.jobTitle} — ${job.area}, ${job.city} — ₹${job.minWage}`}
    >
      <article
        className={`animate-bounce-in relative flex h-full flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
          isFull || isClosed
            ? "border-border bg-muted/20 opacity-60"
            : job.isRapidJob
              ? "border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-card hover:border-orange-500/80 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(249,115,22,0.18)]"
              : "border-border bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-lift"
        }`}
        style={{ animationDelay: `${index * 55}ms` }}
      >
        {/* Rapid Job accent strip */}
        {job.isRapidJob && !isFull && !isClosed && (
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-400" />
        )}

        <div className="flex flex-1 flex-col p-5">
          {/* Rapid badge with live countdown */}
          {job.isRapidJob && (
            <div className="mb-3">
              <RapidJobBadge
                jobDate={job.jobDate}
                startTime={job.startTime}
                endTime={job.endTime}
                rapidJobExpiresAt={job.rapidJobExpiresAt}
                onCutoff={() => setIsCutoff(true)}
                variant="compact"
              />
            </div>
          )}

          {/* Title row */}
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <h2
                className={`text-base font-bold leading-snug ${
                  isFull || isClosed ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {job.jobTitle}
              </h2>

              {/* Category chip */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                    job.isRapidJob && !isFull && !isClosed
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  <span aria-hidden="true">{categoryEmoji(job.category)}</span>
                  {JOB_CATEGORY_LABELS[job.category as JobCategoryValue] ?? job.category}
                </span>
                {job.isVerifiedEmployer && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Location & Distance */}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
            <MapPin className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            <span className="font-medium text-foreground">{job.venueName}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{job.area}, {job.city}</span>
            {distanceInfo.distanceDisplay && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-semibold text-foreground/80">{distanceInfo.distanceDisplay}</span>
              </>
            )}
          </p>

          {/* Date */}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            {formatDate(job.jobDate, job.startTime)}
          </p>

          {/* Work categories pills */}
          {job.categoryNames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.categoryNames.slice(0, 4).map((name: string) => (
                <span
                  key={name}
                  className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
              {job.categoryNames.length > 4 && (
                <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                  +{job.categoryNames.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Wage */}
          <div className="mt-4">
            <p
              className={`font-display text-2xl font-bold ${
                job.isRapidJob && !isFull && !isClosed
                  ? "text-orange-600 dark:text-orange-400"
                  : isFull || isClosed
                    ? "text-muted-foreground"
                    : "text-primary"
              }`}
            >
              {wageDisplay(job.minWage, job.maxWage)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ shift</span>
            </p>
          </div>

          {/* Availability bar */}
          <div className="mt-4">
            <AvailabilityBar
              available={job.availablePositions}
              total={job.totalPositions}
              isRapid={job.isRapidJob}
            />
          </div>

          {/* Facilities */}
          {job.facilities && job.facilities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.facilities.slice(0, 3).map((f: string) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/8 px-2 py-0.5 text-[11px] font-medium text-success"
                >
                  ✓ {f}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-5">
            {isClosed ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-semibold text-muted-foreground">
                Applications Closed
              </div>
            ) : isFull ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-semibold text-muted-foreground">
                All positions filled
              </div>
            ) : (
              <div
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                  job.isRapidJob
                    ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white group-hover:from-orange-600 group-hover:to-orange-500 shadow-[0_2px_12px_rgba(249,115,22,0.25)]"
                    : "bg-primary text-primary-foreground group-hover:opacity-90"
                }`}
              >
                <span>{job.isRapidJob ? "Select Position — Urgent" : "View job"}</span>
                <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Card skeleton (restyled to match new card) ───────────────────────────────

function NewJobCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="animate-bounce-in rounded-2xl border-2 border-border bg-card p-5"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Title */}
      <div className="h-5 w-3/4 rounded-lg bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-24 rounded-lg bg-muted animate-pulse" />
      {/* Location */}
      <div className="mt-4 flex items-center gap-2">
        <div className="size-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-40 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="size-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded-lg bg-muted animate-pulse" />
      </div>
      {/* Category pills */}
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
        <div className="h-5 w-24 rounded-md bg-muted animate-pulse" />
      </div>
      {/* Wage */}
      <div className="mt-4 h-8 w-32 rounded-lg bg-muted animate-pulse" />
      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between">
          <div className="h-3 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
      </div>
      {/* CTA */}
      <div className="mt-5 h-10 w-full rounded-xl bg-muted animate-pulse" />
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  icon: Icon,
  isActive,
  isRapid,
  onClick,
  disabled,
}: {
  label: string;
  icon?: React.ElementType;
  isActive: boolean;
  isRapid?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40 ${
        isActive
          ? isRapid
            ? "border-orange-500 bg-orange-500 text-white shadow-md"
            : "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
      {isActive && <X className="size-3" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function WorkPage() {
  const { isLoggedIn, openLoginModal } = useAuth();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterId[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<JobCategoryValue | "All">("All");

  // Check if Supabase is configured
  const supabaseClient = getSupabase();
  const isMockData = !supabaseClient;

  // Build query params for React Query
  const queryParams = useMemo(() => {
    const params: {
      status?: 'Open' | 'PartiallyFilled';
      category?: JobCategoryValue;
      isRapidJob?: boolean;
      limit?: number;
    } = {
      limit: 50, // Fetch more initially, we'll filter client-side
    };

    if (selectedCategory !== "All") {
      params.category = selectedCategory;
    }

    if (activeFilters.includes("rapid")) {
      params.isRapidJob = true;
    }

    return params;
  }, [selectedCategory, activeFilters]);

  // Fetch jobs using React Query hook
  const { data: baseJobs, isLoading, error, refetch } = useJobs(queryParams, {
    enabled: !isMockData, // Only fetch if Supabase is configured
    staleTime: 2 * 60 * 1000, // 2 minutes for job browsing
  });

  // Transform BaseJob[] to JobListing[] and apply client-side filters
  const jobs = useMemo(() => {
    // Use mock data if Supabase not configured
    if (isMockData || !baseJobs) {
      return MOCK_JOBS;
    }

    // Transform to JobListing format
    let transformed = baseJobs.map(baseJobToJobListing);

    // Apply client-side filters
    if (activeFilters.includes("today")) {
      transformed = transformed.filter(j => j.jobDate === TODAY_ISO);
    }
    if (activeFilters.includes("tomorrow")) {
      transformed = transformed.filter(j => j.jobDate === TOMORROW_ISO);
    }
    if (activeFilters.includes("wage-1500")) {
      transformed = transformed.filter(j => j.maxWage >= 1500);
    }
    if (activeFilters.includes("wage-1200")) {
      transformed = transformed.filter(j => j.maxWage >= 1200);
    }
    if (activeFilters.includes("wage-1000")) {
      transformed = transformed.filter(j => j.maxWage >= 1000);
    }
    if (activeFilters.includes("verified")) {
      transformed = transformed.filter(j => j.isVerifiedEmployer);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      transformed = transformed.filter(j =>
        j.jobTitle.toLowerCase().includes(searchLower) ||
        j.category.toLowerCase().includes(searchLower) ||
        j.area.toLowerCase().includes(searchLower) ||
        j.city.toLowerCase().includes(searchLower) ||
        j.venueName.toLowerCase().includes(searchLower) ||
        (j.description && j.description.toLowerCase().includes(searchLower))
      );
    }

    return transformed;
  }, [baseJobs, activeFilters, searchQuery, isMockData]);

  // Debounce search input
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setDraftSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchQuery(val);
    }, 350);
  };

  // Filter helpers
  const toggleFilter = (f: FilterId) => {
    setActiveFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const clearAll = () => {
    setActiveFilters([]);
    setSelectedCategory("All");
    setDraftSearch("");
    setSearchQuery("");
  };

  const filtersActive =
    activeFilters.length > 0 ||
    selectedCategory !== "All" ||
    searchQuery.trim().length > 0;

  const rapidJobs = useMemo(() => jobs.filter((j: WorkJobListing) => j.isRapidJob), [jobs]);
  const normalJobs = useMemo(() => jobs.filter((j: WorkJobListing) => !j.isRapidJob), [jobs]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-primary">Find work</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Shifts near you</h1>
          <p className="mt-3 text-muted-foreground">
            {isLoading
              ? "Finding open shifts…"
              : `${jobs.length} open shift${jobs.length !== 1 ? "s" : ""}${filtersActive ? " match your filters" : " today"}`}
          </p>
        </div>
        {isMockData && (
          <div className="animate-bounce-in rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            Preview mode — connect Supabase to see live jobs
          </div>
        )}
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="relative mt-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="job-search"
          type="search"
          autoComplete="off"
          placeholder="Search by title, location, or category…"
          value={draftSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-14 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-12 text-base transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-label="Search jobs"
        />
        {draftSearch && (
          <button
            type="button"
            onClick={() => handleSearchChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* ── Category strip ────────────────────────────────────────────────── */}
      <div
        className="mt-5 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by job category"
      >
        <button
          type="button"
          aria-pressed={selectedCategory === "All"}
          onClick={() => setSelectedCategory("All")}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] ${
            selectedCategory === "All"
              ? "border-foreground bg-foreground text-background shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-primary/50"
          }`}
          id="category-all"
        >
          All
        </button>
        {CATEGORY_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={selectedCategory === c.id}
            onClick={() => {
              setSelectedCategory((prev) => (prev === c.id ? "All" : c.id));
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] ${
              selectedCategory === c.id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
            id={`category-${c.id.toLowerCase()}`}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {JOB_CATEGORY_LABELS[c.id]}
          </button>
        ))}
      </div>

      {/* ── Quick filter pills ─────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Filters
        </span>

        <FilterPill
          label={rapidJobs.length > 0 ? `⚡ Rapid Jobs (${rapidJobs.length})` : "⚡ Rapid Jobs"}
          isActive={activeFilters.includes("rapid")}
          isRapid
          onClick={() => toggleFilter("rapid")}
        />
        <FilterPill
          label="Today"
          icon={CalendarDays}
          isActive={activeFilters.includes("today")}
          onClick={() => toggleFilter("today")}
        />
        <FilterPill
          label="Tomorrow"
          icon={CalendarDays}
          isActive={activeFilters.includes("tomorrow")}
          onClick={() => toggleFilter("tomorrow")}
        />
        <FilterPill
          label="₹1,000+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1000")}
          onClick={() => toggleFilter("wage-1000")}
        />
        <FilterPill
          label="₹1,200+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1200")}
          onClick={() => toggleFilter("wage-1200")}
        />
        <FilterPill
          label="₹1,500+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1500")}
          onClick={() => toggleFilter("wage-1500")}
        />
        <FilterPill
          label="Verified"
          icon={BadgeCheck}
          isActive={activeFilters.includes("verified")}
          onClick={() => toggleFilter("verified")}
        />

        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/8 px-3 py-1.5 text-xs font-semibold text-destructive transition-all hover:bg-destructive/15"
            id="clear-all-filters-btn"
          >
            <X className="size-3" strokeWidth={3} aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_296px]">
        <div>
          {/* Error */}
          {error && !isMockData && (
            <ErrorState
              title="Could not load jobs"
              description={error.message}
              onRetry={() => refetch()}
            />
          )}

          {/* Loading skeleton */}
          {isLoading && !error && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <NewJobCardSkeleton key={i} index={i} />
              ))}
            </div>
          )}

          {/* Results */}
          {!isLoading && !error && (
            <>
              {/* Rapid Jobs spotlight section */}
              {rapidJobs.length > 0 && !activeFilters.includes("rapid") && (
                <section className="mb-10 rounded-3xl border-2 border-orange-500/35 bg-gradient-to-b from-orange-500/[0.04] via-card to-card p-5 sm:p-6 shadow-sm" aria-label="Urgent rapid jobs">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
                          <Zap className="size-4 fill-current" aria-hidden="true" />
                        </span>
                        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                          ⚡ Rapid Jobs — Immediate Shifts Needed
                        </h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Urgent jobs where workers are required immediately or within a short time. Real-time countdown &amp; instant booking.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-600 dark:text-orange-400">
                      <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
                      {rapidJobs.length} Urgent Shift{rapidJobs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {rapidJobs.map((job: WorkJobListing) => (
                      <RapidJobSpotlightCard
                        key={job.id}
                        id={job.id}
                        jobTitle={job.jobTitle}
                        category={job.category}
                        venueName={job.venueName}
                        area={job.area}
                        city={job.city}
                        jobDate={job.jobDate}
                        startTime={job.startTime}
                        endTime={job.endTime}
                        wage={job.maxWage || job.minWage}
                        availablePositions={job.availablePositions}
                        totalPositions={job.totalPositions}
                        rapidJobExpiresAt={job.rapidJobExpiresAt}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Regular jobs section */}
              {normalJobs.length > 0 && (
                <section aria-label="Available shifts">
                  {rapidJobs.length > 0 && !activeFilters.includes("rapid") && (
                    <h2 className="mb-4 text-lg font-bold">All open shifts</h2>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(activeFilters.includes("rapid") ? jobs : normalJobs).map(
                      (job: WorkJobListing, i: number) => (
                        <JobCard key={job.id} job={job} index={i} />
                      )
                    )}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {jobs.length === 0 && filtersActive && (
                <EmptyState
                  icon={SearchX}
                  title="No shifts found"
                  description="No shifts match your current filters. Try adjusting them."
                  action={{ label: "Clear filters", onClick: clearAll }}
                  variant="muted"
                />
              )}
              {jobs.length === 0 && !filtersActive && (
                <EmptyState
                  icon={SearchX}
                  title="No shifts found"
                  description="No shifts are available right now. Check back soon!"
                  variant="muted"
                />
              )}
            </>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="h-fit lg:sticky lg:top-24 space-y-4">
          {/* Profile / login nudge card */}
          <div className="rounded-3xl border border-border bg-surface p-6">
            {isLoggedIn ? <LoggedInSidebar /> : <GuestSidebarNudge />}
          </div>

          {/* Stats card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="size-4 text-primary" aria-hidden="true" />
              Live Opportunities
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Open shifts</dt>
                <dd className="font-bold text-primary">{jobs.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Urgent / rapid</dt>
                <dd className="font-bold text-orange-600 dark:text-orange-400">{rapidJobs.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Positions available</dt>
                <dd className="font-bold text-success">
                  {jobs.reduce((s, j) => s + j.availablePositions, 0)}
                </dd>
              </div>
            </dl>
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="mb-3 text-sm font-bold text-primary">How it works</h3>
            <ol className="space-y-2.5 text-xs text-muted-foreground">
              {[
                "Browse open shifts near you",
                "Pick a role and position",
                "Show up and get paid",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Logged-in sidebar ────────────────────────────────────────────────────────

function LoggedInSidebar() {
  const { user } = useAuth();
  return (
    <>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-xl font-bold text-primary-foreground shadow-brand">
        {user?.avatar ?? (user?.name?.[0] ?? "U")}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{user?.name ?? "Your Profile"}</h2>
      {user?.location && (
        <p className="mt-0.5 text-sm text-muted-foreground">{user.location}</p>
      )}
      <div className="mt-3">
        <VerifiedBadge />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        {[
          { label: "Shifts completed", value: "14" },
          { label: "Punctuality",      value: "98%",  cls: "text-success" },
          { label: "Rating",           value: "4.9",  star: true },
        ].map(({ label, value, cls, star }) => (
          <div key={label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={`flex items-center gap-1 font-semibold ${cls ?? ""}`}>
              {star && <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />}
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <Button variant="outline" size="sm" className="mt-5 w-full" asChild>
        <Link to="/profile">Edit profile</Link>
      </Button>
    </>
  );
}

// ─── Guest nudge ──────────────────────────────────────────────────────────────

function GuestSidebarNudge() {
  const { openLoginModal } = useAuth();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Lock className="size-6" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          ?
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold">Ready to find work?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a free account to apply, track applications, and build your verified profile.
      </p>
      <Button
        variant="hero"
        size="lg"
        className="mt-5 w-full"
        onClick={() => openLoginModal({ type: "book-shift" })}
        id="guest-signup-btn"
      >
        Sign up — it's free
      </Button>
      <button
        type="button"
        onClick={() => openLoginModal()}
        className="mt-3 text-sm text-primary hover:underline"
        id="guest-login-btn"
      >
        Already have an account? Log in
      </button>
    </div>
  );
}
