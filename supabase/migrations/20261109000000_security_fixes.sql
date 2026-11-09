-- Security Fixes Migration
-- This migration addresses issues from the previous privacy migration:
-- 1. Drops policies that were not removed due to incorrect names
-- 2. Recreates policies with correct status checks (ACCEPTED vs CONFIRMED)
-- 3. Revokes inappropriate function permissions

-- Drop policies that were missed in the previous migration due to incorrect names
DROP POLICY IF EXISTS "Profiles: authenticated users can read all" ON profiles;
DROP POLICY IF EXISTS "Profiles: anon users can read all" ON profiles;
DROP POLICY IF EXISTS "Job positions: employer can cancel own" ON job_positions;
DROP POLICY IF EXISTS "Applications: employer can update status on own jobs" ON applications;
DROP POLICY IF EXISTS "Applications: worker can cancel own" ON applications;

-- Recreate profiles_select_accepted_connection with correct status check
-- Original used 'CONFIRMED' which is not a valid application status
DROP POLICY IF EXISTS "profiles_select_accepted_connection" ON profiles;
CREATE POLICY "profiles_select_accepted_connection"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM applications a
    INNER JOIN jobs j ON j.id = a.job_id
    WHERE a.status = 'ACCEPTED'  -- Fixed: was 'CONFIRMED'
      AND (
        -- Current user is the employer, viewing the worker
        (j.employer_id = auth.uid() AND a.worker_id = profiles.id)
        OR
        -- Current user is the worker, viewing the employer
        (a.worker_id = auth.uid() AND j.employer_id = profiles.id)
      )
  )
);

-- Recreate job_private_select with correct status check
-- Original used 'CONFIRMED' which is not a valid application status
DROP POLICY IF EXISTS "job_private_select" ON job_private;
CREATE POLICY "job_private_select"
ON job_private
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND (
        -- User is the employer
        j.employer_id = auth.uid()
        OR
        -- User has an ACCEPTED application on this job
        EXISTS (
          SELECT 1
          FROM applications a
          WHERE a.job_id = j.id
            AND a.worker_id = auth.uid()
            AND a.status = 'ACCEPTED'  -- Fixed: was 'CONFIRMED'
        )
      )
  )
);

-- Revoke execute permissions on cleanup_expired_locks function
-- Migration 20261108 incorrectly re-granted these permissions
REVOKE EXECUTE ON FUNCTION cleanup_expired_locks() FROM public;
REVOKE EXECUTE ON FUNCTION cleanup_expired_locks() FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_expired_locks() FROM authenticated;

-- ---------------------------------------------------------------------------
-- Replace reserve_position with improved validation and error handling
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
  v_job record;
  v_existing_application_id uuid;
  v_lock_duration interval := interval '2 minutes';  -- UI promises 2 minutes
  v_current_time timestamptz;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current time in Asia/Kolkata timezone
  v_current_time := now() AT TIME ZONE 'Asia/Kolkata';

  -- Lock the position row
  SELECT jp.* INTO v_position
  FROM job_positions jp
  WHERE jp.id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Get job details
  SELECT j.* INTO v_job
  FROM jobs j
  INNER JOIN job_categories jc ON jc.job_id = j.id
  WHERE jc.id = v_position.job_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  -- Check if caller is the job's employer
  IF v_job.employer_id = v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_apply_own_job');
  END IF;

  -- Check job status
  IF v_job.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_cancelled');
  END IF;

  IF v_job.status = 'Completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_completed');
  END IF;

  -- Check if job date has passed (in Asia/Kolkata timezone)
  IF v_job.job_date < (v_current_time AT TIME ZONE 'Asia/Kolkata')::date THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_date_passed');
  END IF;

  -- Check if rapid job has expired
  IF v_job.is_rapid_job = true AND v_job.rapid_job_expires_at IS NOT NULL THEN
    IF v_job.rapid_job_expires_at < v_current_time THEN
      RETURN jsonb_build_object('success', false, 'error', 'rapid_job_expired');
    END IF;
  END IF;

  -- Treat PENDING with expired lock as AVAILABLE
  -- Release any expired PENDING locks
  IF v_position.status = 'PENDING' AND v_position.lock_expires_at < now() THEN
    UPDATE job_positions
    SET 
      status = 'AVAILABLE',
      worker_id = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
    WHERE id = p_position_id;
    
    v_position.status := 'AVAILABLE';
  END IF;

  -- Check if position is available
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

  -- Release any other PENDING hold this worker has on the same job
  UPDATE job_positions jp
  SET 
    status = 'AVAILABLE',
    worker_id = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE jp.job_category_id IN (
    SELECT jc.id 
    FROM job_categories jc 
    WHERE jc.job_id = v_job.id
  )
  AND jp.worker_id = v_worker_id
  AND jp.status = 'PENDING'
  AND jp.id != p_position_id;

  -- Reserve the position
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
  'Lock a position for 2 minutes with comprehensive validation: checks job status, date, rapid expiry, employer conflict, and releases other holds by the same worker.';

-- ---------------------------------------------------------------------------
-- Replace confirm_booking with unique violation handling
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
  v_job record;
  v_application_id uuid;
  v_job_id uuid;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position
  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Get job details
  SELECT j.* INTO v_job
  FROM jobs j
  INNER JOIN job_categories jc ON jc.job_id = j.id
  WHERE jc.id = v_position.job_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  -- Block if job is cancelled
  IF v_job.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_cancelled');
  END IF;

  -- Verify lock ownership
  IF v_position.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  -- Verify position is in PENDING state
  IF v_position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_pending');
  END IF;

  -- Verify lock not expired
  IF v_position.lock_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_expired');
  END IF;

  -- Get job_id from category
  SELECT job_id INTO v_job_id
  FROM job_categories
  WHERE id = v_position.job_category_id;

  -- Create application with ACCEPTED status (with unique violation handling)
  BEGIN
    INSERT INTO applications (worker_id, job_id, job_category_id, position_id, status, worker_note, confirmed_at)
    VALUES (v_worker_id, v_job_id, v_position.job_category_id, p_position_id, 'ACCEPTED', p_worker_note, now())
    RETURNING id INTO v_application_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_applied');
  END;

  -- Update position status to BOOKED
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
  'Convert PENDING position to BOOKED with ACCEPTED application. Handles unique violations and blocks cancelled jobs.';


-- ---------------------------------------------------------------------------
-- employer_update_application: Employer rejects or completes an application
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION employer_update_application(
  p_application_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer_id uuid;
  v_application record;
  v_job record;
BEGIN
  -- Authenticate
  v_employer_id := auth.uid();
  IF v_employer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Validate status parameter
  IF p_status NOT IN ('REJECTED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  -- Lock and fetch application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- Verify current status is ACCEPTED
  IF v_application.status != 'ACCEPTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_accepted');
  END IF;

  -- Get job details and verify caller is the employer
  SELECT j.* INTO v_job
  FROM jobs j
  WHERE j.id = v_application.job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  IF v_job.employer_id != v_employer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_job_employer');
  END IF;

  -- Update application status and note
  UPDATE applications
  SET 
    status = p_status,
    employer_note = p_note,
    updated_at = now()
  WHERE id = p_application_id;

  -- If REJECTED, free the position seat
  IF p_status = 'REJECTED' THEN
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
    'application_id', p_application_id,
    'new_status', p_status
  );
END;
$$;

COMMENT ON FUNCTION employer_update_application(uuid, text, text) IS
  'Allows employer to reject or complete an ACCEPTED application. REJECTED frees the position seat.';

REVOKE EXECUTE ON FUNCTION employer_update_application(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION employer_update_application(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- complete_my_shift: Worker marks their shift as completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_my_shift(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_application record;
  v_job record;
  v_current_date date;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get current date in Asia/Kolkata timezone
  v_current_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Lock and fetch application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- Verify caller is the application's worker
  IF v_application.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_application');
  END IF;

  -- Verify status is ACCEPTED
  IF v_application.status != 'ACCEPTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_accepted');
  END IF;

  -- Get job details
  SELECT j.* INTO v_job
  FROM jobs j
  WHERE j.id = v_application.job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  -- Verify job_date is today or in the past (Asia/Kolkata)
  IF v_job.job_date > v_current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'shift_not_yet_started');
  END IF;

  -- Update application status to COMPLETED
  UPDATE applications
  SET 
    status = 'COMPLETED',
    updated_at = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'new_status', 'COMPLETED'
  );
END;
$$;

COMMENT ON FUNCTION complete_my_shift(uuid) IS
  'Allows worker to mark their ACCEPTED shift as COMPLETED if job_date has arrived (Asia/Kolkata timezone).';

REVOKE EXECUTE ON FUNCTION complete_my_shift(uuid) FROM public;
GRANT EXECUTE ON FUNCTION complete_my_shift(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Add is_verified column to profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_verified IS
  'Indicates whether the user profile has been verified. Not user-writable.';

-- Note: is_verified is intentionally NOT included in the GRANT UPDATE statement
-- so users cannot modify their own verification status

-- ---------------------------------------------------------------------------
-- Update public_profiles view to include is_verified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public_profiles
WITH (security_invoker = false)
AS
SELECT 
  id,
  name,
  avatar_url,
  location,
  is_verified
FROM profiles;

COMMENT ON VIEW public_profiles IS
  'Public subset of profile data visible to all users, including verification status.';

-- Ensure view permissions remain correct
GRANT SELECT ON public_profiles TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_public_stats: Returns platform statistics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_jobs integer;
  v_open_jobs_by_category jsonb;
  v_registered_users integer;
  v_positions_booked integer;
  v_current_date date;
  v_current_time timestamptz;
BEGIN
  -- Get current date and time in Asia/Kolkata timezone
  v_current_time := now() AT TIME ZONE 'Asia/Kolkata';
  v_current_date := v_current_time::date;

  -- Count open jobs
  -- Open = status 'Open' or 'PartiallyFilled'
  -- job_date >= today (Asia/Kolkata)
  -- rapid jobs must not be expired
  SELECT COUNT(*) INTO v_open_jobs
  FROM jobs
  WHERE status IN ('Open', 'PartiallyFilled')
    AND job_date >= v_current_date
    AND (
      is_rapid_job = false 
      OR rapid_job_expires_at IS NULL 
      OR rapid_job_expires_at > v_current_time
    );

  -- Count open jobs by category
  SELECT jsonb_object_agg(category, job_count)
  INTO v_open_jobs_by_category
  FROM (
    SELECT 
      category,
      COUNT(*) as job_count
    FROM jobs
    WHERE status IN ('Open', 'PartiallyFilled')
      AND job_date >= v_current_date
      AND (
        is_rapid_job = false 
        OR rapid_job_expires_at IS NULL 
        OR rapid_job_expires_at > v_current_time
      )
    GROUP BY category
  ) category_counts;

  -- If no jobs, return empty object instead of null
  IF v_open_jobs_by_category IS NULL THEN
    v_open_jobs_by_category := '{}'::jsonb;
  END IF;

  -- Count registered users
  SELECT COUNT(*) INTO v_registered_users
  FROM profiles;

  -- Count positions booked (status = BOOKED)
  SELECT COUNT(*) INTO v_positions_booked
  FROM job_positions
  WHERE status = 'BOOKED';

  RETURN jsonb_build_object(
    'open_jobs', v_open_jobs,
    'open_jobs_by_category', v_open_jobs_by_category,
    'registered_users', v_registered_users,
    'positions_booked', v_positions_booked
  );
END;
$$;

COMMENT ON FUNCTION get_public_stats() IS
  'Returns public platform statistics: open jobs (with category breakdown), registered users, and booked positions.';

-- Grant execute to anon and authenticated
REVOKE EXECUTE ON FUNCTION get_public_stats() FROM public;
GRANT EXECUTE ON FUNCTION get_public_stats() TO anon, authenticated;
