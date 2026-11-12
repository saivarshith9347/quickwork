import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Search,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";

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

function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth();

  if (!user) return null;

  const firstName = user.name?.split(" ")[0] ?? "there";
  
  // Query worker stats: shifts completed
  const { data: completedShifts = 0 } = useQuery({
    queryKey: ["worker-shifts-completed", user.id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase not configured");
      const { count, error } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("worker_id", user.id)
        .eq("status", "COMPLETED");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Query employer stats: jobs posted
  const { data: jobsPosted = 0 } = useQuery({
    queryKey: ["employer-jobs-posted", user.id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase not configured");
      const { count, error} = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("employer_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Query employer stats: workers hired (positions with BOOKED status)
  const { data: workersHired = 0 } = useQuery({
    queryKey: ["employer-workers-hired", user.id],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase not configured");
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id")
        .eq("employer_id", user.id);
      
      if (jobsError) throw jobsError;
      if (!jobs || jobs.length === 0) return 0;

      const jobIds = jobs.map((j) => j.id);
      const { count, error } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .in("job_id", jobIds)
        .eq("status", "BOOKED");
      
      if (error) throw error;
      return count ?? 0;
    },
  });

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
          {user.isVerified && <VerifiedBadge label="Verified" tone="success" />}
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
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <CalendarDays className="size-5 text-primary" />
          <p className="mt-3 font-display text-2xl font-bold">{completedShifts}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Shifts completed</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Briefcase className="size-5 text-primary" />
          <p className="mt-3 font-display text-2xl font-bold">{jobsPosted}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Jobs posted</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Users className="size-5 text-primary" />
          <p className="mt-3 font-display text-2xl font-bold">{workersHired}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Workers hired</p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* ── Quick links to other pages ── */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your applications</h2>
            <Link to="/work" className="text-sm font-semibold text-primary hover:underline">
              Browse shifts →
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            View and manage your job applications on the Work page.
          </p>
        </section>

        {/* ── Posted jobs link ── */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your posted jobs</h2>
            <Link to="/my-jobs" className="text-sm font-semibold text-primary hover:underline">
              View all jobs →
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your job listings and review applicants on the My Jobs page.
          </p>
        </section>
      </div>
    </div>
  );
}
