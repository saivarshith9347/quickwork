import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Plus,
  Star,
  Users,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedBadge } from "@/components/verified-badge";
import { ApplicationCard } from "@/components/application-card";
import { useAuth } from "@/lib/auth-context";
import { useApplications, seedMockApplications } from "@/lib/application-model";
import {
  formatLocation,
  getLocationArea,
  formatDuration,
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  getFillPercentage,
  type JobCategoryValue,
  type JobTypeValue,
  type JobStatusValue,
} from "@/lib/job-types";

export const Route = createFileRoute("/hire")({
  head: () => ({
    meta: [
      { title: "Post a Shift — QuickWork" },
      {
        name: "description",
        content:
          "Post a catering shift in under a minute, review verified applicants and track job status from your QuickWork account.",
      },
      { property: "og:title", content: "QuickWork — Post a Shift" },
      {
        property: "og:description",
        content: "Post shifts, review verified applicants and track every booking in one place.",
      },
    ],
  }),
  component: HirePage,
});

// ─── Mock data ────────────────────────────────────────────────────────────────

const facilities = ["Meals provided", "Transport", "Uniform", "Locker room"];

type JobSummary = {
  id: string;
  jobTitle: string;
  category: JobCategoryValue;
  positionsRequired: number;
  positionsConfirmed: number;
  positionsRemaining: number;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  location: string;
  area: string;
  wage: string;
  status: JobStatusValue;
  jobType: JobTypeValue;
  postedAt: string;
};

const jobs: JobSummary[] = [
  {
    id: "1",
    jobTitle: "Banquet servers for wedding",
    category: "Hospitality",
    positionsRequired: 8,
    positionsConfirmed: 6,
    positionsRemaining: 2,
    date: "Fri, 14 Sep",
    startTime: "17:00",
    endTime: "23:00",
    duration: 360,
    location: "Grand Palm Banquets, Andheri East, Mumbai",
    area: "Andheri East",
    wage: "₹1,200",
    status: "PartiallyFilled",
    jobType: "one-time",
    postedAt: "2 hours ago",
  },
  {
    id: "2",
    jobTitle: "Kitchen helpers for catering",
    category: "Hospitality",
    positionsRequired: 4,
    positionsConfirmed: 4,
    positionsRemaining: 0,
    date: "Sat, 15 Sep",
    startTime: "09:00",
    endTime: "16:00",
    duration: 420,
    location: "Commercial Kitchen Complex, Powai, Mumbai",
    area: "Powai",
    wage: "₹950",
    status: "FullyFilled",
    jobType: "one-time",
    postedAt: "1 day ago",
  },
  {
    id: "3",
    jobTitle: "Dishwashing crew",
    category: "Hospitality",
    positionsRequired: 3,
    positionsConfirmed: 0,
    positionsRemaining: 3,
    date: "Sun, 16 Sep",
    startTime: "19:00",
    endTime: "01:00",
    duration: 360,
    location: "Coastal Restaurant, Lower Parel, Mumbai",
    area: "Lower Parel",
    wage: "₹900",
    status: "Open",
    jobType: "recurring",
    postedAt: "3 hours ago",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function HirePage() {
  const { isLoggedIn, openLoginModal, user } = useAuth();
  const { getApplicationsForJob, getJobApplicationStats, getConfirmedCount } = useApplications();

  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>(["Meals provided"]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.id || null);

  // Seed mock applications on first load
  useEffect(() => {
    const hasSeeded = sessionStorage.getItem("applications-seeded");
    if (!hasSeeded) {
      seedMockApplications();
      sessionStorage.setItem("applications-seeded", "true");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  // Get applications for selected job
  const selectedJobApplications = selectedJobId ? getApplicationsForJob(selectedJobId) : [];
  const selectedJobStats = selectedJobId ? getJobApplicationStats(selectedJobId) : null;
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  function handlePostShift(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      openLoginModal({ type: "post-shift" });
      return;
    }
    toast.success("Shift posted — verified workers nearby are being notified.");
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Post a shift</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">
            {isLoggedIn ? "Hire workers" : "Post a shift"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isLoggedIn
              ? "3 active shifts · 14 workers booked this week"
              : "Log in to post shifts and manage applicants."}
          </p>
        </div>
        {isLoggedIn && <VerifiedBadge label="Verified" tone="success" />}
      </div>

      {/* Gate banner for logged-out visitors */}
      {!isLoggedIn && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/8 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Lock className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Log in to post and manage shifts</p>
              <p className="text-sm text-muted-foreground">
                Browse applicants below — sign in to start hiring.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openLoginModal()}>
              Log in
            </Button>
            <Button variant="hero" size="sm" onClick={() => openLoginModal({ type: "post-shift" })}>
              Sign up free
            </Button>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Post a shift form */}
        <form
          className="rounded-3xl border border-border bg-surface p-7 lg:p-9"
          onSubmit={handlePostShift}
        >
          <h2 className="text-2xl">Post a shift</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Six fields. Workers see it instantly. Prefer a guided flow?{" "}
            <Link to="/post-job" className="font-semibold text-primary hover:underline">
              Use the 4-step wizard
            </Link>
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Start time</Label>
              <Input id="time" type="time" required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Venue name, area" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workers">Workers needed</Label>
              <Input id="workers" type="number" min={1} defaultValue={4} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wage">Wage per shift (₹)</Label>
              <Input id="wage" type="number" min={0} step={50} defaultValue={1200} required />
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Facilities provided</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {facilities.map((f) => {
                const on = picked.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))}
                    className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.03] ${
                      on
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" variant="hero" size="lg" className="mt-8 w-full">
            {isLoggedIn ? (
              <>
                <Plus /> Post shift
              </>
            ) : (
              <>
                <Lock className="size-4" /> Log in to post
              </>
            )}
          </Button>
        </form>

        {/* Applications Review — always visible, actions gated */}
        <div className="rounded-3xl border border-border bg-surface p-7 lg:p-9">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl">Applications</h2>
              {selectedJob && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedJob.jobTitle} · {selectedJob.date} · {selectedJob.startTime} –{" "}
                  {selectedJob.endTime}
                </p>
              )}
            </div>
            {selectedJobStats && (
              <div className="text-right">
                <p className="text-2xl font-bold">{selectedJobStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            )}
          </div>

          {/* Job selector for multiple jobs */}
          {isLoggedIn && jobs.length > 1 && (
            <div className="mt-4">
              <Label htmlFor="job-select">Select job:</Label>
              <select
                id="job-select"
                value={selectedJobId || ""}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.jobTitle} — {job.date}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Application Stats */}
          {selectedJobStats && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-amber-600">{selectedJobStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-success">{selectedJobStats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Confirmed</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-primary">{selectedJobStats.waitlisted}</p>
                <p className="text-xs text-muted-foreground">Waitlist</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-muted-foreground">
                  {selectedJobStats.notSelected}
                </p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          )}

          {/* Applications List */}
          <div className="mt-7 space-y-4">
            {loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-3 h-3 w-1/2" />
                  <Skeleton className="mt-5 h-9 w-28 rounded-lg" />
                </div>
              ))
            ) : selectedJobApplications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <ClipboardList className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No applications yet for this job.
                </p>
                {!isLoggedIn && (
                  <Button
                    variant="hero"
                    size="sm"
                    className="mt-4"
                    onClick={() => openLoginModal()}
                  >
                    Log in to view applications
                  </Button>
                )}
              </div>
            ) : (
              selectedJobApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  viewMode="employer"
                  showActions={isLoggedIn}
                  onStatusChange={(jobId, confirmedCount) => {
                    // Update job positions when application status changes
                    toast.success(`Updated: ${confirmedCount} worker(s) confirmed for this job`);
                    // Force re-render to show updated counts
                    setSelectedJobId(selectedJobId);
                  }}
                />
              ))
            )}
          </div>

          {/* View all link */}
          {isLoggedIn && selectedJobApplications.length > 3 && (
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link to="/hire">
                <ClipboardList className="size-4" />
                View all {selectedJobApplications.length} applications
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Shifts section — only shown when logged in */}
      {isLoggedIn && (
        <section className="mt-14">
          <h2 className="text-2xl">Your shifts</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-6">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-4 h-3 w-1/2" />
                    <Skeleton className="mt-2 h-3 w-2/5" />
                    <Skeleton className="mt-6 h-8 w-24 rounded-lg" />
                  </div>
                ))
              : jobs.map((job) => {
                  const statusColors = JOB_STATUS_COLORS[job.status];
                  const fillPercentage = getFillPercentage(
                    job.positionsRequired,
                    job.positionsConfirmed,
                  );
                  const jobStats = getJobApplicationStats(job.id);

                  return (
                    <article
                      key={job.id}
                      className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg">{job.jobTitle}</h3>
                          <span className="mt-1 inline-block rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {JOB_CATEGORY_LABELS[job.category]}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusColors.border} ${statusColors.bg} ${statusColors.text}`}
                        >
                          {JOB_STATUS_LABELS[job.status]}
                        </span>
                      </div>

                      {/* Application Stats */}
                      {jobStats.total > 0 && (
                        <div className="mt-4 flex items-center gap-2">
                          <ClipboardList className="size-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {jobStats.total} application{jobStats.total === 1 ? "" : "s"}
                            {jobStats.pending > 0 && (
                              <span className="ml-1 text-amber-600">
                                ({jobStats.pending} pending)
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="mt-4">
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="size-4" /> {job.positionsConfirmed} of{" "}
                          {job.positionsRequired} confirmed
                        </p>
                        {/* Progress bar */}
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {job.positionsRemaining > 0
                            ? `${job.positionsRemaining} position${job.positionsRemaining === 1 ? "" : "s"} remaining`
                            : "Fully staffed"}
                        </p>
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4" /> {job.date} · {job.startTime} –{" "}
                        {job.endTime}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4" /> {job.area}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4" /> {formatDuration(job.duration)} ·{" "}
                        {JOB_TYPE_LABELS[job.jobType]}
                      </p>
                      <p className="mt-5 flex items-center gap-2 font-display text-xl font-bold text-primary">
                        <Wallet className="size-5" /> {job.wage}
                        <span className="text-sm font-medium text-muted-foreground">/ worker</span>
                      </p>
                      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        Posted {job.postedAt}
                      </p>

                      {/* Action buttons */}
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          <ClipboardList className="size-4" />
                          View Applications
                        </Button>
                      </div>
                    </article>
                  );
                })}
          </div>
        </section>
      )}
    </div>
  );
}
