import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Search,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — QuickWork" },
      {
        name: "description",
        content: "Post jobs or find work — manage everything from one QuickWork dashboard.",
      },
    ],
  }),
  component: DashboardPage,
});

// ─── Mock activity data ───────────────────────────────────────────────────────

const recentShifts = [
  {
    id: "1",
    role: "Banquet server",
    employer: "Grand Palm Banquets",
    date: "Tue, 18 Aug · 5 PM",
    area: "Andheri East",
    wage: "₹1,200",
    status: "Upcoming",
    statusColor: "text-primary bg-primary/10",
  },
  {
    id: "2",
    role: "Kitchen helper",
    employer: "Saffron Caterers",
    date: "Wed, 19 Aug · 9 AM",
    area: "Powai",
    wage: "₹950",
    status: "Confirmed",
    statusColor: "text-emerald-600 bg-emerald-500/10",
  },
];

const postedJobs = [
  {
    id: "1",
    role: "Banquet servers",
    date: "Fri, 14 Aug · 5 PM",
    area: "Andheri East",
    filled: 6,
    total: 8,
    status: "Filling",
    statusColor: "text-amber-600 bg-amber-500/10",
  },
  {
    id: "2",
    role: "Kitchen helpers",
    date: "Sat, 15 Aug · 9 AM",
    area: "Powai",
    filled: 4,
    total: 4,
    status: "Confirmed",
    statusColor: "text-emerald-600 bg-emerald-500/10",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { isLoggedIn, user, openLoginModal } = useAuth();
  const navigate = useNavigate();

  // Redirect guests to login, then back here
  useEffect(() => {
    if (!isLoggedIn) {
      openLoginModal({ type: "dashboard" });
      navigate({ to: "/" });
    }
  }, [isLoggedIn, openLoginModal, navigate]);

  if (!isLoggedIn || !user) return null;

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Your dashboard</p>
          <h1 className="mt-1.5 font-display text-4xl font-bold sm:text-5xl">
            Hey, {firstName} 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            {user.location ?? "Set your location to see nearby shifts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VerifiedBadge label="Verified" tone="success" />
        </div>
      </div>

      {/* ── Two primary action cards ── */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {/* Find Work */}
        <Link
          to="/work"
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
            <Search className="size-7" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">Find Work</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Browse verified shifts near you. Wage shown upfront — book in one tap.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Banquet", "Kitchen", "Events", "Warehouse"].map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-primary">
            Browse shifts{" "}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        {/* Post a Job */}
        <Link
          to="/hire"
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
            <Plus className="size-7" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">Post a Job</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Hire verified workers for your next shift. Fill spots in under a minute.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Quick post", "4-step wizard", "Applicants", "Manage"].map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-primary">
            Post a shift{" "}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      {/* ── Stats strip ── */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: CalendarDays, label: "Shifts worked", value: "14" },
          { icon: Star, label: "Rating", value: "4.9" },
          { icon: Briefcase, label: "Jobs posted", value: "3" },
          { icon: Users, label: "Workers hired", value: "22" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5">
            <Icon className="size-5 text-primary" />
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* ── Applied / booked shifts ── */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your booked shifts</h2>
            <Link to="/work" className="text-sm font-semibold text-primary hover:underline">
              Browse more →
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recentShifts.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{s.role}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.statusColor}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.employer}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {s.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" /> {s.area}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Wallet className="size-3.5" /> {s.wage}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Posted jobs ── */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your posted jobs</h2>
            <Link to="/my-jobs" className="text-sm font-semibold text-primary hover:underline">
              View all jobs →
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {postedJobs.map((j) => (
              <li
                key={j.id}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{j.role}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${j.statusColor}`}
                    >
                      {j.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {j.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" /> {j.area}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {j.filled}/{j.total} booked
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Link to="/my-jobs">
            <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
              <Briefcase className="size-4" /> View All My Jobs
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
