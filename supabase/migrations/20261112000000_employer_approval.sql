-- ===========================================================================
-- Employer approval flow
--
-- Before: confirm_booking created the application as ACCEPTED and BOOKED the
-- position immediately — the employer never got a say.
--
-- After:
--   worker reserve_position  → position PENDING (2-min lock)
--   worker confirm_booking   → application PENDING, position stays PENDING but
--                              linked to the application with no lock expiry
--                              (held for the employer's decision)
--   employer accepts         → application ACCEPTED, position BOOKED
--   employer rejects         → application REJECTED, position AVAILABLE
--   worker cancels           → (unchanged) application CANCELLED, position AVAILABLE
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- confirm_booking: create a PENDING request instead of an instant booking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_booking(p_position_id uuid, p_worker_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_job record;
  v_application_id uuid;
BEGIN
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  SELECT j.* INTO v_job
  FROM jobs j
  INNER JOIN job_categories jc ON jc.job_id = j.id
  WHERE jc.id = v_position.job_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  IF v_job.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_cancelled');
  END IF;

  IF v_position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_pending');
  END IF;

  IF v_position.worker_id IS DISTINCT FROM v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  IF v_position.application_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_applied');
  END IF;

  IF v_position.lock_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_expired');
  END IF;

  BEGIN
    INSERT INTO applications (worker_id, job_id, job_category_id, position_id, status, worker_note)
    VALUES (v_worker_id, v_job.id, v_position.job_category_id, p_position_id, 'PENDING', p_worker_note)
    RETURNING id INTO v_application_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_applied');
  END;

  -- Keep the seat held for the employer's decision: stays PENDING, linked to
  -- the application, and the lock no longer expires.
  UPDATE job_positions
  SET
    application_id = v_application_id,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'position_id', p_position_id,
    'status', 'PENDING'
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- employer_update_application: accept / reject requests, complete bookings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employer_update_application(p_application_id uuid, p_status text, p_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employer_id uuid;
  v_application record;
  v_job record;
BEGIN
  v_employer_id := auth.uid();
  IF v_employer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_status NOT IN ('ACCEPTED', 'REJECTED', 'COMPLETED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  SELECT j.* INTO v_job FROM jobs j WHERE j.id = v_application.job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  IF v_job.employer_id != v_employer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_job_employer');
  END IF;

  -- Allowed transitions
  IF p_status = 'ACCEPTED' AND v_application.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_pending');
  END IF;
  IF p_status = 'REJECTED' AND v_application.status NOT IN ('PENDING', 'ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_reject_status');
  END IF;
  IF p_status = 'COMPLETED' AND v_application.status != 'ACCEPTED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_accepted');
  END IF;

  IF p_status = 'ACCEPTED' AND v_job.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_cancelled');
  END IF;

  UPDATE applications
  SET
    status = p_status,
    employer_note = COALESCE(p_note, employer_note),
    confirmed_at = CASE WHEN p_status = 'ACCEPTED' THEN now() ELSE confirmed_at END
  WHERE id = p_application_id;

  IF p_status = 'ACCEPTED' THEN
    UPDATE job_positions
    SET
      status = 'BOOKED',
      worker_id = v_application.worker_id,
      application_id = p_application_id,
      locked_at = NULL,
      lock_expires_at = NULL
    WHERE id = v_application.position_id;
  ELSIF p_status = 'REJECTED' THEN
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
$function$;

-- ---------------------------------------------------------------------------
-- release_position: a worker cannot drop a seat that is awaiting the
-- employer's decision (they must cancel the application instead).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
  v_position record;
BEGIN
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_position
  FROM job_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  IF v_position.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_pending');
  END IF;

  IF v_position.worker_id IS DISTINCT FROM v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  IF v_position.application_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'awaiting_employer');
  END IF;

  UPDATE job_positions
  SET
    status = 'AVAILABLE',
    worker_id = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object('success', true, 'position_id', p_position_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- reserve_position: when a worker picks a new seat, only drop their *unsubmitted*
-- holds on the same job — never a seat already awaiting employer approval.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_job record;
  v_existing_application_id uuid;
  v_lock_duration interval := interval '2 minutes';
  v_today date;
BEGIN
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  SELECT jp.* INTO v_position
  FROM job_positions jp
  WHERE jp.id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  SELECT j.* INTO v_job
  FROM jobs j
  INNER JOIN job_categories jc ON jc.job_id = j.id
  WHERE jc.id = v_position.job_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_not_found');
  END IF;

  IF v_job.employer_id = v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_apply_own_job');
  END IF;

  IF v_job.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_cancelled');
  END IF;

  IF v_job.status = 'Completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_completed');
  END IF;

  IF v_job.job_date < v_today THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_date_passed');
  END IF;

  IF v_job.is_rapid_job = true AND v_job.rapid_job_expires_at IS NOT NULL
     AND v_job.rapid_job_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'rapid_job_expired');
  END IF;

  -- An expired, unsubmitted lock counts as AVAILABLE
  IF v_position.status = 'PENDING'
     AND v_position.application_id IS NULL
     AND v_position.lock_expires_at < now() THEN
    UPDATE job_positions
    SET status = 'AVAILABLE', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
    WHERE id = p_position_id;
    v_position.status := 'AVAILABLE';
  END IF;

  IF v_position.status != 'AVAILABLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_available');
  END IF;

  SELECT id INTO v_existing_application_id
  FROM applications
  WHERE position_id = p_position_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  IF v_existing_application_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_already_applied');
  END IF;

  -- Release this worker's other *unsubmitted* holds on the same job
  UPDATE job_positions jp
  SET status = 'AVAILABLE', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE jp.job_id = v_job.id
    AND jp.worker_id = v_worker_id
    AND jp.status = 'PENDING'
    AND jp.application_id IS NULL
    AND jp.id != p_position_id;

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
$function$;

-- cleanup_expired_locks already skips rows with lock_expires_at IS NULL
-- (NULL < now() is not true), so seats awaiting approval are never swept.
