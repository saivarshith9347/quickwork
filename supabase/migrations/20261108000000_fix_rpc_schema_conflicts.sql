-- =============================================================================
-- QuickWork — Fix RPC Security Migration Schema Conflicts
-- 20261108000000_fix_rpc_schema_conflicts.sql
--
-- PROBLEM:
-- Migration 20261002000000_rpc_security.sql introduced RPC functions that
-- reference incorrect table and column names, creating a conflict with the
-- original schema (20261001000000_initial_schema.sql).
--
-- CONFLICTS IDENTIFIED:
-- 1. RPC references "positions" table → Should be "job_positions"
-- 2. RPC references "locked_by" column → Should be "worker_id"
-- 3. RPC references "category_id" → Should be "job_category_id"
-- 4. RPC uses "LOCKED" status → Should be "PENDING"
-- 5. RPC uses "CONFIRMED" status → Should be "BOOKED" or "ACCEPTED"
--
-- SOLUTION:
-- This migration corrects the RPC functions to match the authoritative schema
-- established in 20261001000000_initial_schema.sql, which is the source of truth.
-- =============================================================================

-- ============================================================================
-- 1. DROP INCORRECT RPC FUNCTIONS FROM 20261002000000
-- ============================================================================

DROP FUNCTION IF EXISTS reserve_position(uuid);
DROP FUNCTION IF EXISTS confirm_booking(uuid, text);
DROP FUNCTION IF EXISTS release_position(uuid);
DROP FUNCTION IF EXISTS cancel_application(uuid);

-- ============================================================================
-- 2. RECREATE RPC FUNCTIONS WITH CORRECT SCHEMA REFERENCES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reserve_position: Lock a position for the authenticated worker
-- Uses auth.uid() for security, no client-supplied worker_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_existing_application_id uuid;
  v_lock_duration interval := interval '5 minutes';
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position row (CORRECT TABLE NAME: job_positions)
  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Check if position is available (CORRECT STATUS: AVAILABLE)
  IF v_position.status != 'AVAILABLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_available');
  END IF;

  -- Check for existing active application
  SELECT id INTO v_existing_application_id
  FROM applications
  WHERE position_id = p_position_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  IF v_existing_application_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_already_applied');
  END IF;

  -- Reserve the position (CORRECT STATUS: PENDING, CORRECT COLUMN: worker_id)
  UPDATE job_positions
  SET 
    status = 'PENDING',
    worker_id = v_worker_id,
    locked_at = now(),
    lock_expires_at = now() + v_lock_duration
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'position_id', p_position_id,
    'lock_expires_at', (now() + v_lock_duration)::text
  );
END;
$$;

COMMENT ON FUNCTION reserve_position(uuid) IS
  'Atomically lock a position for authenticated worker. Uses correct schema: job_positions table, worker_id column, PENDING status.';

-- ---------------------------------------------------------------------------
-- confirm_booking: Convert reserved position to confirmed application
-- Creates application record and updates position to BOOKED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_booking(
  p_position_id uuid,
  p_worker_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_application_id uuid;
  v_job_id uuid;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position (CORRECT TABLE: job_positions)
  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Verify lock ownership (CORRECT COLUMN: worker_id)
  IF v_position.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  -- Verify position is in PENDING state (CORRECT STATUS)
  IF v_position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_pending');
  END IF;

  -- Verify lock not expired
  IF v_position.lock_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_expired');
  END IF;

  -- Get job_id from category (CORRECT COLUMN: job_category_id)
  SELECT job_id INTO v_job_id
  FROM job_categories
  WHERE id = v_position.job_category_id;

  -- Create application with ACCEPTED status (matches initial schema)
  INSERT INTO applications (worker_id, job_id, job_category_id, position_id, status, worker_note, confirmed_at)
  VALUES (v_worker_id, v_job_id, v_position.job_category_id, p_position_id, 'ACCEPTED', p_worker_note, now())
  RETURNING id INTO v_application_id;

  -- Update position status to BOOKED (CORRECT STATUS)
  UPDATE job_positions
  SET 
    status = 'BOOKED',
    application_id = v_application_id,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'position_id', p_position_id
  );
END;
$$;

COMMENT ON FUNCTION confirm_booking(uuid, text) IS
  'Convert PENDING position to BOOKED with ACCEPTED application. Uses correct schema references.';

-- ---------------------------------------------------------------------------
-- release_position: Release a lock held by the authenticated worker
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position (CORRECT TABLE)
  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Verify it's in PENDING state (CORRECT STATUS)
  IF v_position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_pending');
  END IF;

  -- Verify lock ownership (CORRECT COLUMN)
  IF v_position.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  -- Release the lock (CORRECT STATUS: AVAILABLE)
  UPDATE job_positions
  SET 
    status = 'AVAILABLE',
    worker_id = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'position_id', p_position_id
  );
END;
$$;

COMMENT ON FUNCTION release_position(uuid) IS
  'Release PENDING lock on position. Uses correct schema references.';

-- ---------------------------------------------------------------------------
-- cancel_application: Cancel an application owned by authenticated worker
-- Sets application to CANCELLED and returns position to AVAILABLE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_application record;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- Verify ownership
  IF v_application.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_application');
  END IF;

  -- Check if cancellable (CORRECT STATUSES: PENDING or ACCEPTED)
  IF v_application.status NOT IN ('PENDING', 'ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel_status');
  END IF;

  -- Cancel the application
  UPDATE applications
  SET 
    status = 'CANCELLED',
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_application_id;

  -- If there's a position, release it (CORRECT TABLE AND COLUMNS)
  IF v_application.position_id IS NOT NULL THEN
    UPDATE job_positions
    SET 
      status = 'AVAILABLE',
      worker_id = NULL,
      application_id = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
    WHERE id = v_application.position_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id
  );
END;
$$;

COMMENT ON FUNCTION cancel_application(uuid) IS
  'Cancel application and release position. Uses correct schema references.';

-- ============================================================================
-- 3. GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION reserve_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION release_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_application(uuid) TO authenticated;

-- ============================================================================
-- 4. UPDATE PARTIAL UNIQUE INDEX (already correct, but ensure it exists)
-- ============================================================================

-- Drop old constraint if it somehow still exists
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_unique_position;

-- Ensure partial unique index exists (one active application per position)
CREATE UNIQUE INDEX IF NOT EXISTS applications_position_active_unique
ON applications (position_id)
WHERE status NOT IN ('CANCELLED', 'REJECTED');

-- ============================================================================
-- 5. CLEANUP EXPIRED LOCKS FUNCTION (ensure it uses correct table name)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH released AS (
    UPDATE job_positions
    SET 
      status = 'AVAILABLE',
      worker_id = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      updated_at = now()
    WHERE status = 'PENDING'
      AND lock_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM released;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_locks() IS
  'Releases all stale PENDING position locks. Uses correct table name: job_positions.';

GRANT EXECUTE ON FUNCTION cleanup_expired_locks() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_locks() TO anon;

-- ============================================================================
-- 6. SETUP pg_cron FOR AUTOMATIC LOCK CLEANUP
-- ============================================================================

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing schedule if present
SELECT cron.unschedule('cleanup-expired-locks') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-locks'
);

-- Schedule the job to run every minute
SELECT cron.schedule(
  'cleanup-expired-locks',
  '* * * * *',
  'SELECT cleanup_expired_locks();'
);

-- =============================================================================
-- Done. RPC functions now correctly reference:
--   • job_positions (not "positions")
--   • worker_id (not "locked_by")
--   • job_category_id (not "category_id")
--   • PENDING, BOOKED, AVAILABLE statuses (not "LOCKED"/"CONFIRMED")
-- =============================================================================
