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
  AlertCircle,
  Loader2,
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
import { JobService } from "@/lib/services/job-service";
import { ApplicationService } from "@/lib/services/application-service";
import type { Application } from "@/lib/services/application-service";
import {
  formatLocation,
  getLocationArea,
  formatDuration,
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  getFillPercentage,
  type BaseJob,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const facilities = ["Meals provided", "Transport", "Uniform", "Locker room"];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatJobDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function getLocationDisplay(job: BaseJob): string {
  if (typeof job.location === "string") return job.location;
  return job.location.fullAddress;
}

function getAreaDisplay(job: BaseJob): string {
  if (typeof job.location === "string") return job.location.split(",")[0] || "";
  return job.location.area;
}

function calculateApplicationStats(applications: Application[]) {
  return {
    total: applications.length,
    pending: applications.filter((a) => a.status === "PENDING").length,
    confirmed: applications.filter((a) => 
      a.status === "CONFIRMED" || a.status === "BOOKED" || a.status === "ACCEPTED"
    ).length,
    waitlisted: 0, // Not used in Supabase schema
    notSelected: applications.filter((a) => a.status === "REJECTED").length,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function HirePage() {
  const { isLoggedIn, openLoginModal, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(["Meals provided"]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BaseJob[]>([]);
  const [applications, setApplications] = useState<Record<string, Application[]>>({});

  // Fetch employer's jobs
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchJobs = async () => {
      setLoading(true);
      setError(null);

      const result = await JobService.getJobs({ employerId: user.id });

      if (result.success) {
        setJobs(result.jobs);
        if (result.jobs.length > 0 && !selectedJobId) {
          setSelectedJobId(result.jobs[0]!.id);
        }
      } else {
        setError(result.error);
        toast.error("Failed to load jobs");
      }

      setLoading(false);
    };

    fetchJobs();
  }, [isLoggedIn, user?.id]);

  // Fetch applications for all jobs
  useEffect(() => {
    if (!isLoggedIn || jobs.length === 0) return;

    const fetchApplications = async () => {
      const applicationsMap: Record<string, Application[]> = {};

      for (const job of jobs) {
        const result = await ApplicationService.getJobApplications({ jobId: job.id });
        if (result.success) {
          applicationsMap[job.id] = result.applications;
        }
      }

      setApplications(applicationsMap);
    };

    fetchApplications();
  }, [isLoggedIn, jobs]);

  // Get applications for selected job
  const selectedJobApplications = selectedJobId ? (applications[selectedJobId] || []) : [];
  const selectedJobStats = selectedJobId ? calculateApplicationStats(selectedJobApplications) : null;
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const [posting, setPosting] = useState(false);

  async function handlePostShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoggedIn || !user?.id) {
      openLoginModal({ type: "post-shift" });
      return;
    }

    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const title = String(fd.get("title") ?? "").trim();
    const date = String(fd.get("date") ?? "");
    const startTime = String(fd.get("startTime") ?? "");
    const endTime = String(fd.get("endTime") ?? "");
    const locationRaw = String(fd.get("location") ?? "").trim();
    const workers = Number(fd.get("workers"));
    const wage = Number(fd.get("wage"));

    const parts = locationRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const venueName = parts[0] ?? locationRaw;
    const area = parts[1] ?? parts[0] ?? locationRaw;
    const city = parts[parts.length - 1] ?? locationRaw;

    setPosting(true);
    const result = await JobService.createJob({
      job: {
        employerId: user.id,
        jobTitle: title,
        category: "Other",
        description: `${title} shift at ${locationRaw}`,
        location: { venueName, fullAddress: locationRaw, area, city },
        date,
        startTime,
        endTime,
        facilities: picked.length > 0 ? picked : undefined,
      },
      categories: [{ name: title, requiredWorkers: workers, wage }],
    });
    setPosting(false);

    if (!result.success) {
      toast.error("Failed to post shift", { description: result.error });
      return;
    }

    toast.success("Shift posted — verified workers nearby are being notified.");
    formEl.reset();

    const refreshed = await JobService.getJobs({ employerId: user.id });
    if (refreshed.success) {
      setJobs(refreshed.jobs);
      setSelectedJobId(result.jobId);
    }
  }

  const handleStatusChange = async () => {
    // Refresh applications when status changes
    if (selectedJobId) {
      const result = await ApplicationService.getJobApplications({ jobId: selectedJobId });
      if (result.success) {
        setApplications((prev) => ({
          ...prev,
          [selectedJobId]: result.applications,
        }));
      }
    }
  };

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
              ? `${jobs.length} active shift${jobs.length === 1 ? "" : "s"}`
              : "Log in to post shifts and manage applicants."}
          </p>
        </div>
        {isLoggedIn && user?.isVerified && <VerifiedBadge label="Verified" tone="success" />}
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
            Quick form. Workers see it instantly. Prefer a guided flow?{" "}
            <Link to="/post-job" className="font-semibold text-primary hover:underline">
              Use the 4-step wizard
            </Link>
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="title">Role</Label>
              <Input id="title" name="title" placeholder="e.g. Banquet server" minLength={3} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" min={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Start time</Label>
              <Input id="time" name="startTime" type="time" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">End time</Label>
              <Input id="endTime" name="endTime" type="time" required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Venue name, area, city" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workers">Workers needed</Label>
              <Input id="workers" name="workers" type="number" min={1} defaultValue={4} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wage">Wage per shift (₹)</Label>
              <Input id="wage" name="wage" type="number" min={1} step={50} defaultValue={1200} required />
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

          <Button type="submit" variant="hero" size="lg" className="mt-8 w-full" disabled={posting}>
            {posting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Posting…
              </>
            ) : isLoggedIn ? (
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
            ) : !isLoggedIn ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Lock className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Log in to view applications
                </p>
                <Button
                  variant="hero"
                  size="sm"
                  className="mt-4"
                  onClick={() => openLoginModal()}
                >
                  Log in
                </Button>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
                <AlertCircle className="mx-auto size-12 text-destructive" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {error}
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <ClipboardList className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No jobs posted yet. Create your first shift above!
                </p>
              </div>
            ) : selectedJobApplications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <ClipboardList className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No applications yet for this job.
                </p>
              </div>
            ) : (
              selectedJobApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  viewMode="employer"
                  showActions={isLoggedIn}
                  onStatusChange={handleStatusChange}
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
                  const jobStats = applications[job.id] ? calculateApplicationStats(applications[job.id]!) : null;

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
                      {jobStats && jobStats.total > 0 && (
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
                        <MapPin className="size-4" /> {getAreaDisplay(job)}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4" /> {formatDuration(job.duration ?? 0)} ·{" "}
                        {JOB_TYPE_LABELS[job.jobType]}
                      </p>
                      <p className="mt-5 flex items-center gap-2 font-display text-xl font-bold text-primary">
                        <Wallet className="size-5" /> ₹{job.wage.toLocaleString("en-IN")}
                        <span className="text-sm font-medium text-muted-foreground">/ worker</span>
                      </p>
                      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        Posted {formatJobDate(job.createdAt)}
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
