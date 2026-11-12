/**
 * Notifications bell
 *
 * Employer side: pending job requests on jobs they posted, with inline
 * Accept / Reject (via the employer_update_application RPC).
 * Worker side: decisions on their own requests (accepted / not selected)
 * from the last 7 days.
 *
 * Data is derived from the applications table (no separate notifications
 * table). Realtime changes on `applications` (already in the
 * supabase_realtime publication, filtered by RLS) trigger a refetch.
 */

import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { ApplicationService } from "@/lib/services/application-service";

type RequestItem = {
  id: string;
  appliedAt: string;
  jobId: string;
  jobTitle: string;
  jobDate: string;
  workerName: string;
  positionNumber: number | null;
};

type DecisionItem = {
  id: string;
  status: "ACCEPTED" | "REJECTED";
  wasRemoved: boolean;
  updatedAt: string;
  jobId: string;
  jobTitle: string;
  jobDate: string;
};

const SEEN_KEY = "qw_notifications_seen_at";

function readSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSeenAt(ts: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(ts));
  } catch {
    // storage unavailable — unread dot just won't persist
  }
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

async function fetchNotifications(userId: string) {
  const supabase = getSupabase();
  if (!supabase) return { requests: [] as RequestItem[], decisions: [] as DecisionItem[] };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [reqRes, decRes] = await Promise.all([
    supabase
      .from("applications")
      .select(
        `id, applied_at, job_id,
         worker:public_profiles!applications_worker_id_fkey ( name ),
         job:jobs!applications_job_id_fkey!inner ( job_title, job_date, employer_id ),
         position:job_positions!applications_position_id_fkey ( position_number )`,
      )
      .eq("status", "PENDING")
      .eq("job.employer_id", userId)
      .order("applied_at", { ascending: false })
      .limit(20),
    supabase
      .from("applications")
      .select(
        `id, status, updated_at, confirmed_at, job_id,
         job:jobs!applications_job_id_fkey ( job_title, job_date )`,
      )
      .eq("worker_id", userId)
      .in("status", ["ACCEPTED", "REJECTED"])
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  if (reqRes.error) throw reqRes.error;
  if (decRes.error) throw decRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined PostgREST rows
  const requests: RequestItem[] = (reqRes.data ?? []).map((r: any) => ({
    id: r.id,
    appliedAt: r.applied_at,
    jobId: r.job_id,
    jobTitle: r.job?.job_title ?? "Your job",
    jobDate: r.job?.job_date ?? "",
    workerName: r.worker?.name ?? "A worker",
    positionNumber: r.position?.position_number ?? null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined PostgREST rows
  const decisions: DecisionItem[] = (decRes.data ?? []).map((d: any) => ({
    id: d.id,
    status: d.status,
    // Rejected after having been accepted (confirmed_at set) = removed by employer
    wasRemoved: d.status === "REJECTED" && !!d.confirmed_at,
    updatedAt: d.updated_at,
    jobId: d.job_id,
    jobTitle: d.job?.job_title ?? "A job",
    jobDate: d.job?.job_date ?? "",
  }));

  return { requests, decisions };
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", userId];

  useEffect(() => setSeenAt(readSeenAt()), []);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(userId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: any change to applications visible to this user → refetch
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const channel = client
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const requests = data?.requests ?? [];
  const decisions = data?.decisions ?? [];
  const unseenDecisions = decisions.filter((d) => new Date(d.updatedAt).getTime() > seenAt);
  const badgeCount = requests.length + unseenDecisions.length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening the panel marks decisions as seen (requests stay until handled)
      const now = Date.now();
      writeSeenAt(now);
      // keep current highlight while panel is open; clear dot on next render cycle
      setTimeout(() => setSeenAt(now), 0);
    }
  }

  async function decide(
    applicationId: string,
    status: "ACCEPTED" | "REJECTED",
    workerName: string,
  ) {
    setActingId(applicationId);
    const res = await ApplicationService.employerUpdateApplication(applicationId, status);
    setActingId(null);
    if (!res.success) {
      toast.error(status === "ACCEPTED" ? "Couldn't accept request" : "Couldn't reject request", {
        description: res.error,
      });
    } else {
      toast.success(
        status === "ACCEPTED"
          ? `${workerName} is booked for this shift`
          : `Request from ${workerName} declined`,
      );
    }
    void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={badgeCount > 0 ? `Notifications (${badgeCount} new)` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
        className="relative flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:scale-[1.03]"
      >
        <Bell className="size-4" />
        {badgeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-primary-foreground">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-rise rounded-2xl border border-border bg-card p-2 shadow-lift">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Notifications
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : requests.length === 0 && decisions.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto">
              {requests.map((r) => (
                <div key={r.id} className="rounded-xl px-3 py-3 hover:bg-accent/50">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">{r.workerName}</span>{" "}
                    <span className="text-muted-foreground">wants to take</span>{" "}
                    <Link
                      to="/hire/$jobId"
                      params={{ jobId: r.jobId }}
                      onClick={() => setOpen(false)}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {r.jobTitle}
                    </Link>
                    {r.positionNumber != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        · Position {String(r.positionNumber).padStart(2, "0")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(r.appliedAt)}</p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => void decide(r.id, "ACCEPTED", r.workerName)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {actingId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => void decide(r.id, "REJECTED", r.workerName)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {requests.length > 0 && decisions.length > 0 && (
                <div className="my-1.5 h-px bg-border" />
              )}

              {decisions.map((d) => {
                const isNew = new Date(d.updatedAt).getTime() > seenAt;
                return (
                  <Link
                    key={d.id}
                    to="/my-applications"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-accent/50"
                  >
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                        d.status === "ACCEPTED"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.status === "ACCEPTED" ? (
                        <Check className="size-3.5" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-foreground">
                        {d.status === "ACCEPTED"
                          ? `You're booked for ${d.jobTitle}`
                          : d.wasRemoved
                            ? `You were removed from ${d.jobTitle}`
                            : `Not selected for ${d.jobTitle}`}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {timeAgo(d.updatedAt)}
                      </span>
                    </span>
                    {isNew && (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="New"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
