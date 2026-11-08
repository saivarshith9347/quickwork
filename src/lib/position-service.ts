/**
 * position-service.ts
 *
 * Typed wrappers around the Supabase RPCs defined in migration
 * 20261001000001_position_generation.sql.
 *
 * All position mutations go through here — never raw .from("job_positions").
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Architecture contract                                  │
 * │  ─────────────────────────────────────────────────────  │
 * │  • DB is source of truth                                │
 * │  • BOOKED positions are NEVER removed automatically     │
 * │  • PENDING locks expire after 2 minutes (cleanup_expired_locks) │
 * │  • Positions are numbered 1..N per category             │
 * │  • Category DELETE is blocked when positions are BOOKED  │
 * └─────────────────────────────────────────────────────────┘
 */

import { supabase, getSupabase } from "./supabase";

// ─── Result types ──────────────────────────────────────────────────────────────

export type ServiceResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Position status ───────────────────────────────────────────────────────────

export type PositionStatus = "AVAILABLE" | "PENDING" | "BOOKED" | "CANCELLED";

// ─── Stats returned by the debug RPC ──────────────────────────────────────────

export interface CategoryPositionEntry {
  id: string;
  position_number: number;
  status: PositionStatus;
  locked_until: string | null;
}

export interface CategoryPositionStats {
  category_id: string;
  category_name: string;
  required_workers: number;
  total: number;
  available: number;
  pending: number;
  pending_live: number;
  pending_expired: number;
  booked: number;
  cancelled: number;
  active: number;
  positions: CategoryPositionEntry[];
}

export interface JobPositionStats {
  job_id: string;
  total: number;
  available: number;
  pending: number;
  booked: number;
  cancelled: number;
  active: number;
  categories: CategoryPositionStats[];
}

// ─── Adjust-RPC response ───────────────────────────────────────────────────────

export interface AdjustPositionsResult {
  success: boolean;
  action?: "no_change" | "increased" | "decreased";

  // Increase fields
  positions_added?: number;
  new_active_count?: number;

  // Decrease fields
  requested_count?: number;
  effective_count?: number;
  positions_cancelled?: number;
  capped_by_bookings?: boolean;
  locked_positions?: number;

  // No-op field
  active_count?: number;

  error?: string;
}

// ─── API ───────────────────────────────────────────────────────────────────────

/**
 * Fetch a full stats snapshot for a job (all categories + all positions).
 * Uses the STABLE, read-only fn_get_job_position_stats RPC.
 */
export async function getJobPositionStats(
  jobId: string,
): Promise<ServiceResult<JobPositionStats>> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: "Supabase client not initialized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc("fn_get_job_position_stats", {
    p_job_id: jobId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as JobPositionStats };
}

/**
 * Fetch a stats snapshot for a single category.
 */
export async function getCategoryPositionStats(
  categoryId: string,
): Promise<ServiceResult<CategoryPositionStats>> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: "Supabase client not initialized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc("fn_get_category_position_stats", {
    p_category_id: categoryId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as CategoryPositionStats };
}

/**
 * Employer-safe headcount adjustment.
 *
 * Increasing: adds new AVAILABLE positions.
 * Decreasing: cancels AVAILABLE/expired-PENDING from highest number down.
 *             Never cancels BOOKED or live-PENDING positions.
 *             If bookings prevent full reduction, returns capped_by_bookings=true.
 *
 * This calls employer_adjust_category_headcount() which verifies job ownership.
 */
export async function adjustCategoryHeadcount(
  categoryId: string,
  newCount: number,
): Promise<ServiceResult<AdjustPositionsResult>> {
  if (newCount < 1) {
    return { ok: false, error: "new_count_must_be_at_least_1" };
  }

  const client = getSupabase();
  if (!client) {
    return { ok: false, error: "Supabase client not initialized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc(
    "employer_adjust_category_headcount",
    {
      p_category_id: categoryId,
      p_new_count: newCount,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as AdjustPositionsResult;

  if (!result.success) {
    return { ok: false, error: result.error ?? "adjustment_failed" };
  }

  return { ok: true, data: result };
}

/**
 * Idempotent gap-fill for a category.
 *
 * Use this after any operation that might have left a category with fewer
 * positions than required_workers (e.g., a partial insert failure).
 * Safe to call multiple times — ON CONFLICT DO NOTHING.
 *
 * Returns the number of newly inserted rows.
 */
export async function fillMissingPositions(
  categoryId: string,
): Promise<ServiceResult<number>> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: "Supabase client not initialized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc(
    "fn_fill_positions_for_category",
    { p_category_id: categoryId },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: (data as number) ?? 0 };
}

export interface PositionUpdatePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export interface PositionSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribe to live position updates for a job.
 * Uses Supabase Realtime targeted exclusively to `job_positions` filtered by `job_id`.
 * Avoids memory leaks by removing the channel from the client on unsubscribe.
 *
 * @param jobId    The job to watch
 * @param onUpdate Called whenever any position row changes
 */
export function subscribeToJobPositions(
  jobId: string,
  onUpdate: (payload: PositionUpdatePayload) => void,
): PositionSubscription {
  const channelName = `job_positions:${jobId}`;

  const client = getSupabase();
  if (!client) {
    console.warn("[position-service] Supabase not configured, skipping realtime subscription");
    return {
      unsubscribe: () => {
        // No-op
      },
    };
  }

  // 1. Supabase Realtime channel (strictly job_positions table)
  const channel = client.channel(channelName);

  channel
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "job_positions",
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => {
        onUpdate({
          eventType: "UPDATE",
          newRow: (payload.new as Record<string, unknown>) ?? null,
          oldRow: (payload.old as Record<string, unknown>) ?? null,
        });
      },
    )
    .on(
      "broadcast",
      { event: "position_status_update" },
      ({ payload }) => {
        if (payload) {
          onUpdate({
            eventType: "UPDATE",
            newRow: payload as Record<string, unknown>,
            oldRow: null,
          });
        }
      },
    )
    .subscribe();

  // 2. Cross-tab synchronization via browser BroadcastChannel (desktop & mobile)
  let localBc: BroadcastChannel | null = null;
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      localBc = new BroadcastChannel(`qw_positions_${jobId}`);
      localBc.onmessage = (event) => {
        if (event.data && typeof event.data === "object") {
          onUpdate({
            eventType: "UPDATE",
            newRow: event.data as Record<string, unknown>,
            oldRow: null,
          });
        }
      };
    } catch {
      // BroadcastChannel unavailable in this context
    }
  }

  return {
    unsubscribe: () => {
      try {
        void channel.unsubscribe();
        if (client) {
          void client.removeChannel(channel);
        }
      } catch (err) {
        console.warn("[Realtime] Error removing channel:", err);
      }
      if (localBc) {
        try {
          localBc.close();
        } catch {}
        localBc = null;
      }
    },
  };
}

/**
 * Broadcasts a position update to other workers and tabs viewing this job.
 */
export function broadcastPositionUpdate(
  jobId: string,
  payload: {
    id: string;
    job_id: string;
    status: PositionStatus;
    position_number?: number;
    category_id?: string;
    worker_id?: string | null;
    lock_expires_at?: string | null;
  },
) {
  const client = getSupabase();
  
  // 1. Send via Supabase Realtime broadcast
  if (client) {
    try {
      const channel = client.channel(`job_positions:${jobId}`);
      channel.send({
        type: "broadcast",
        event: "position_status_update",
        payload,
      });
    } catch {
      // Supabase client may be offline
    }
  }

  // 2. Send via local BroadcastChannel for instant cross-tab sync
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(`qw_positions_${jobId}`);
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 100);
    } catch {
      // Local broadcast not permitted
    }
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Human-readable label for a position status.
 */
export function statusLabel(status: PositionStatus): string {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "PENDING":   return "Hold (2 min)";
    case "BOOKED":    return "Booked";
    case "CANCELLED": return "Cancelled";
  }
}

/**
 * CSS colour token for a position status badge.
 * Returns a Tailwind class string.
 */
export function statusColour(status: PositionStatus): string {
  switch (status) {
    case "AVAILABLE": return "bg-success/15 text-success border-success/30";
    case "PENDING":   return "bg-gold/15 text-gold-foreground border-gold/40";
    case "BOOKED":    return "bg-primary/15 text-primary border-primary/30";
    case "CANCELLED": return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Returns a zero-padded position label.
 * e.g. formatPositionNumber(3, 12) → "Position 03"
 *      formatPositionNumber(1, 5)  → "Position 01"
 */
export function formatPositionNumber(n: number, total: number): string {
  const digits = total >= 100 ? 3 : 2;
  return `Position ${String(n).padStart(digits, "0")}`;
}
