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
  TrendingUpIcon,
  Zap,
  AlertCircle,
} from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";

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

// ─── Trending Jobs ────────────────────────────────────────────────────────────

const trendingJobs = [
  {
    role: "Banquet server",
    employer: "Grand Palm Banquets",
    wage: "₹1,200 / shift",
    area: "Andheri East",
    date: "Tomorrow · 4:00 PM",
    tags: ["Meals", "Uniform"],
  },
  {
    role: "Warehouse loader",
    employer: "Urban Logistics Co.",
    wage: "₹1,100 / shift",
    area: "Bhiwandi",
    date: "Today · 10:00 AM",
    tags: ["Lunch", "Transport"],
  },
  {
    role: "Event steward",
    employer: "Blue Orchid Events",
    wage: "₹1,400 / shift",
    area: "Bandra Kurla",
    date: "Wed · 3:00 PM",
    tags: ["Transport"],
  },
  {
    role: "Retail helper",
    employer: "MegaMart Superstore",
    wage: "₹950 / shift",
    area: "Ghatkopar",
    date: "Thu · 9:00 AM",
    tags: ["Meals"],
  },
  {
    role: "Kitchen helper",
    employer: "Saffron Caterers",
    wage: "₹950 / shift",
    area: "Powai",
    date: "Tue · 9:00 AM",
    tags: ["Meals", "Transport"],
  },
  {
    role: "Housekeeping",
    employer: "Zenith Hotels",
    wage: "₹850 / shift",
    area: "Marine Lines",
    date: "Today · 6:00 PM",
    tags: ["Uniform"],
  },
  {
    role: "Delivery associate",
    employer: "QuickDeliver",
    wage: "₹1,300 / shift",
    area: "Thane",
    date: "Wed · 8:00 AM",
    tags: ["Transport"],
  },
  {
    role: "Catering assistant",
    employer: "Royal Feast",
    wage: "₹1,050 / shift",
    area: "Malad",
    date: "Fri · 5:00 PM",
    tags: ["Meals", "Uniform"],
  },
];

// ─── Activity Stats ───────────────────────────────────────────────────────────

const activityStats = {
  totalOpenJobs: 847,
  jobsFilledToday: 213,
  trendingCategories: [
    { name: "Hospitality", count: 245, trend: "+18%", color: "text-primary" },
    { name: "Events", count: 189, trend: "+24%", color: "text-gold" },
    { name: "Warehouse", count: 167, trend: "+12%", color: "text-success" },
  ],
};

// ─── Rapid Jobs (Urgent) ──────────────────────────────────────────────────────

const rapidJobs = [
  {
    id: "rapid-1",
    role: "Warehouse loaders needed urgently",
    employer: "Urban Logistics Hub",
    wage: 1320,
    baseWage: 1100,
    surgePercent: 20,
    area: "Bhiwandi",
    startsIn: "45 min",
    startsInMinutes: 45,
    tags: ["Meals", "Transport"],
    category: "Warehouse",
  },
  {
    id: "rapid-2",
    role: "Event stewards for last-minute booking",
    employer: "Metro Events Co.",
    wage: 1680,
    baseWage: 1400,
    surgePercent: 20,
    area: "Bandra Kurla",
    startsIn: "30 min",
    startsInMinutes: 30,
    tags: ["Uniform"],
    category: "Events",
  },
  {
    id: "rapid-3",
    role: "Kitchen staff for emergency catering",
    employer: "Royal Feast Caterers",
    wage: 1140,
    baseWage: 950,
    surgePercent: 20,
    area: "Andheri East",
    startsIn: "55 min",
    startsInMinutes: 55,
    tags: ["Meals", "Transport"],
    category: "Hospitality",
  },
];

// ─── Categories ───────────────────────────────────────────────────────────────

const categories = [
  { name: "Catering", icon: Wrench, count: "245", color: "bg-primary/10 text-primary" },
  {
    name: "Warehousing",
    icon: HardHat,
    count: "189",
    color: "bg-gold/10 text-gold-foreground dark:text-gold",
  },
  { name: "Logistics", icon: TrendingUp, count: "132", color: "bg-success/10 text-success" },
  { name: "Retail", icon: Users, count: "98", color: "bg-primary/10 text-primary" },
  {
    name: "Events",
    icon: CalendarCheck,
    count: "167",
    color: "bg-gold/10 text-gold-foreground dark:text-gold",
  },
  { name: "Housekeeping", icon: Sparkles, count: "87", color: "bg-success/10 text-success" },
];

// ─── Index ────────────────────────────────────────────────────────────────────

function Index() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollJobs(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }

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

          {/* Trust stats strip */}
          <div className="mt-16 grid max-w-3xl grid-cols-2 gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl sm:grid-cols-4">
            {[
              ["12 min", "Average fill time"],
              ["4.9", "Average rating"],
              ["98%", "Punctuality rate"],
              ["18,400+", "Verified workers"],
            ].map(([value, label]) => (
              <div key={label} className="text-center">
                <dt className="font-display text-2xl font-bold text-white sm:text-3xl">{value}</dt>
                <dd className="mt-1 text-xs text-white/60 sm:text-sm">{label}</dd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Activity Stats ── */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl">QuickWork activity right now</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Real-time snapshot of what's happening across the platform today
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Open Jobs */}
          <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Open Jobs</p>
                <p className="font-display text-3xl font-bold text-primary">
                  {activityStats.totalOpenJobs.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Across all categories and locations
            </p>
          </div>

          {/* Jobs Filled Today */}
          <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-success/10 text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Jobs Filled Today</p>
                <p className="font-display text-3xl font-bold text-success">
                  {activityStats.jobsFilledToday.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Shifts successfully booked in the last 24 hours
            </p>
          </div>

          {/* Trending Categories */}
          <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold-foreground dark:text-gold">
                <TrendingUpIcon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Trending Categories</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {activityStats.trendingCategories.map((cat) => (
                <li key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">({cat.count} jobs)</span>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${cat.color}`}>
                    <TrendingUp className="size-3" />
                    {cat.trend}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Most active categories this week</p>
          </div>
        </div>
      </section>

      {/* ── Rapid Jobs (URGENT) ── */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border-2 border-[#D62E1F]/30 bg-gradient-to-br from-[#D62E1F]/5 via-background to-background p-8 lg:p-12">
          {/* Pulsing background effect */}
          <div className="absolute inset-0 bg-[#D62E1F]/5 animate-pulse" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex size-12 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#D62E1F]/40" />
                  <span className="relative flex size-12 items-center justify-center rounded-full bg-[#D62E1F] text-white shadow-lg">
                    <Zap className="size-6" />
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-[#D62E1F] sm:text-4xl">Rapid Jobs</h2>
                  <p className="text-sm text-muted-foreground">
                    Starting within the next hour — act fast!
                  </p>
                </div>
              </div>
              <div className="ml-auto">
                <span className="inline-flex animate-pulse items-center gap-2 rounded-lg border-2 border-[#D62E1F] bg-[#D62E1F]/10 px-3 py-1.5 text-sm font-bold text-[#D62E1F]">
                  <AlertCircle className="size-4" />
                  {rapidJobs.length} URGENT SHIFTS
                </span>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rapidJobs.map((job) => (
                <article
                  key={job.id}
                  className="relative overflow-hidden rounded-2xl border-2 border-[#D62E1F]/40 bg-card p-6 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
                >
                  {/* Pulsing urgent badge */}
                  <div className="absolute right-4 top-4">
                    <span className="relative flex">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D62E1F] opacity-75" />
                      <span className="relative inline-flex items-center gap-1.5 rounded-lg bg-[#D62E1F] px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                        <Zap className="size-3" />
                        URGENT
                      </span>
                    </span>
                  </div>

                  <h3 className="pr-20 text-lg font-semibold">{job.role}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{job.employer}</p>

                  {/* Wage with surge indicator */}
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2">
                      <p className="flex items-center gap-2 font-display text-2xl font-bold text-[#D62E1F]">
                        <Wallet className="size-5" /> ₹{job.wage.toLocaleString()}
                      </p>
                      <span className="rounded-md bg-[#D62E1F]/15 px-2 py-0.5 text-xs font-bold text-[#D62E1F]">
                        +{job.surgePercent}% SURGE
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-through">
                      Normal rate: ₹{job.baseWage.toLocaleString()}
                    </p>
                  </div>

                  {/* Time and location */}
                  <div className="mt-4 space-y-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#D62E1F]">
                      <Clock className="size-4 shrink-0" />
                      Starts in {job.startsIn}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" /> {job.area}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    variant="default"
                    size="lg"
                    className="mt-6 w-full bg-[#D62E1F] text-white hover:bg-[#B02518] shadow-lg"
                    asChild
                  >
                    <Link to="/work">
                      <Zap className="size-4" />
                      Book Now — {job.surgePercent}% Extra!
                    </Link>
                  </Button>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-[#D62E1F]/30 bg-[#D62E1F]/5 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-[#D62E1F]" />
                  <p className="text-sm font-medium">
                    <span className="font-bold text-[#D62E1F]">
                      Matched workers get instant push notifications
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      — and a reminder at 15 minutes if still unfilled
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trending jobs horizontal scroll ── */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl">Trending jobs near you</h2>
            <p className="mt-2 text-muted-foreground">Shifts posted in the last 24 hours</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scrollJobs("left")}
              aria-label="Scroll left"
              className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollJobs("right")}
              aria-label="Scroll right"
              className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="mt-6 flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {trendingJobs.map((job, i) => (
            <article
              key={i}
              className="w-72 shrink-0 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
            >
              <h3 className="text-lg font-semibold">{job.role}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{job.employer}</p>
              <p className="mt-4 flex items-center gap-2 font-display text-xl font-bold text-primary">
                <Wallet className="size-5" /> {job.wage}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0" /> {job.area}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarCheck className="size-4 shrink-0" /> {job.date}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Button variant="hero" size="lg" asChild>
            <Link to="/work">
              Browse all shifts <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

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
