import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Clock,
  HardHat,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  Briefcase,
  CheckCircle2,
  Zap,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickWork — Find Verified Daily-Wage Workers Near You" },
      {
        name: "description",
        content:
          "Find skilled workers for catering, warehousing, logistics, retail, events and housekeeping. Post a shift or find work in minutes.",
      },
      { property: "og:title", content: "QuickWork — Verified Workers, Booked Fast" },
      {
        property: "og:description",
        content:
          "Search by category and location. 12-minute average fill time. 4.9 employer rating.",
      },
    ],
  }),
  component: Index,
});

// ─── Category metadata ────────────────────────────────────────────────────────

const categoryMeta = {
  Catering: { icon: Wrench, color: "bg-primary/10 text-primary" },
  Warehousing: { icon: HardHat, color: "bg-gold/10 text-gold-foreground dark:text-gold" },
  Logistics: { icon: TrendingUp, color: "bg-success/10 text-success" },
  Retail: { icon: Users, color: "bg-primary/10 text-primary" },
  Events: { icon: CalendarCheck, color: "bg-gold/10 text-gold-foreground dark:text-gold" },
  Housekeeping: { icon: Sparkles, color: "bg-success/10 text-success" },
} as const;

// ─── Index ────────────────────────────────────────────────────────────────────

function Index() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch public stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return null;

      const { data, error } = await supabase.rpc("get_public_stats");

      if (error || !data) {
        console.error("Failed to fetch public stats:", error);
        return null;
      }

      return data as {
        open_jobs: number;
        open_jobs_by_category: Record<string, number>;
        registered_users: number;
        positions_booked: number;
      };
    },
    staleTime: 60000, // 1 minute
  });

  function scrollJobs(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }

  const openJobs = stats?.open_jobs ?? 0;
  const registeredUsers = stats?.registered_users ?? 0;
  const positionsBooked = stats?.positions_booked ?? 0;
  const categoryBreakdown = stats?.open_jobs_by_category ?? {};

  // Build categories array from real data
  const categories = Object.entries(categoryBreakdown)
    .map(([name, count]) => {
      const meta = categoryMeta[name as keyof typeof categoryMeta];
      if (!meta) return null;
      return {
        name,
        icon: meta.icon,
        count: count as number,
        color: meta.color,
      };
    })
    .filter((cat): cat is NonNullable<typeof cat> => cat !== null && cat.count > 0);

  return (
    <div className="pb-20">
      {/* ── Hero with search ── */}
      <section className="mesh-hero relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <span className="inline-flex animate-bounce-in items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <Sparkles className="size-3.5" /> Now live across 6 categories
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] font-bold text-white sm:text-6xl lg:text-7xl">
            Find verified workers or pick up a shift,{" "}
            <span className="text-brand-gradient">right now</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/75">
            One account. Post a job in minutes or find verified work near you — no role-switching
            needed.
          </p>

          {/* Search bar */}
          <div className="mt-10 max-w-2xl">
            <div className="flex flex-col gap-4 rounded-2xl bg-white/10 p-1 backdrop-blur-xl sm:flex-row">
              <select className="h-14 w-full rounded-xl border-0 bg-white/15 px-4 text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30 sm:w-auto">
                <option value="">All categories</option>
                <option value="catering">Catering</option>
                <option value="warehousing">Warehousing</option>
                <option value="logistics">Logistics</option>
                <option value="retail">Retail</option>
                <option value="events">Events</option>
                <option value="housekeeping">Housekeeping</option>
              </select>
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="Enter area or city"
                  className="h-14 w-full rounded-xl border-0 bg-white/15 pl-12 pr-4 text-white placeholder:text-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <Button variant="hero" size="xl" className="h-14 sm:w-44" asChild>
                <Link to="/work">Browse Shifts</Link>
              </Button>
            </div>
            <p className="mt-4 text-center text-sm text-white/60">
              Want to hire instead?{" "}
              <Link to="/hire" className="font-semibold text-white hover:underline">
                Post a shift
              </Link>
            </p>
          </div>

          {/* Trust stats strip - only show stats with real values > 0 */}
          {(openJobs > 0 || registeredUsers > 0 || positionsBooked > 0) && (
            <div className="mt-16 grid max-w-3xl gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl"
              style={{
                gridTemplateColumns: `repeat(${[openJobs > 0, registeredUsers > 0, positionsBooked > 0].filter(Boolean).length}, 1fr)`
              }}
            >
              {openJobs > 0 && (
                <div className="text-center">
                  <dt className="font-display text-2xl font-bold text-white sm:text-3xl">
                    {statsLoading ? <Loader2 className="inline size-6 animate-spin" /> : openJobs.toLocaleString()}
                  </dt>
                  <dd className="mt-1 text-xs text-white/60 sm:text-sm">Open jobs</dd>
                </div>
              )}
              {registeredUsers > 0 && (
                <div className="text-center">
                  <dt className="font-display text-2xl font-bold text-white sm:text-3xl">
                    {statsLoading ? <Loader2 className="inline size-6 animate-spin" /> : registeredUsers.toLocaleString()}
                  </dt>
                  <dd className="mt-1 text-xs text-white/60 sm:text-sm">Registered users</dd>
                </div>
              )}
              {positionsBooked > 0 && (
                <div className="text-center">
                  <dt className="font-display text-2xl font-bold text-white sm:text-3xl">
                    {statsLoading ? <Loader2 className="inline size-6 animate-spin" /> : positionsBooked.toLocaleString()}
                  </dt>
                  <dd className="mt-1 text-xs text-white/60 sm:text-sm">Positions booked</dd>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Activity Stats ── */}
      {stats && (stats.open_jobs > 0 || stats.positions_booked > 0) && (
        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl">QuickWork activity right now</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Real-time snapshot of what's happening across the platform today
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* Total Open Jobs */}
            {stats.open_jobs > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Briefcase className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Open Jobs</p>
                    <p className="font-display text-3xl font-bold text-primary">
                      {stats.open_jobs.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Across all categories and locations
                </p>
              </div>
            )}

            {/* Positions Booked */}
            {stats.positions_booked > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-success/10 text-success">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Positions Booked</p>
                    <p className="font-display text-3xl font-bold text-success">
                      {stats.positions_booked.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Successfully booked across all jobs
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Trending jobs section hidden - will show real data once available */}

      {/* ── Category grid ── */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl">Browse shifts by category</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Six categories, one platform. Find work or hire for any of them today.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.name}
                to="/work"
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className={`flex size-12 items-center justify-center rounded-xl ${cat.color}`}>
                  <Icon className="size-6" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <p className="text-sm text-muted-foreground">{cat.count} open shifts</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Trust section ── */}
      <section id="trust" className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 rounded-3xl border border-border bg-surface p-8 lg:grid-cols-2 lg:p-14">
          <div>
            <VerifiedBadge label="Skill Verification Program" />
            <h2 className="mt-5 text-3xl sm:text-4xl">
              Every worker is verified before they ever take a shift.
            </h2>
            <p className="mt-4 text-muted-foreground">
              ID and address checks, a practical skill assessment per trade, and shift-by-shift
              ratings. Pass the program and you carry the gold Verified Professional Badge.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                ["Government ID + address verified", ShieldCheck],
                ["Hands-on skill test per trade", BadgeCheck],
                ["Punctuality tracked every shift", Clock],
              ].map(([text, Icon]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <li key={text as string} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
                      <I className="size-4" />
                    </span>
                    {text as string}
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" asChild>
                <Link to="/work">Get verified</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/hire">Post a shift</Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative flex size-64 items-center justify-center rounded-full border border-gold/25">
                <div className="flex size-44 items-center justify-center rounded-full bg-[image:linear-gradient(140deg,var(--gold),var(--brand))] shadow-gold">
                  <BadgeCheck className="size-16 text-gold-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
