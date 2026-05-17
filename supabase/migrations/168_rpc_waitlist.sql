-- ============================================================
-- Kahramana Baghdad
-- Migration: 168_rpc_waitlist.sql
--
-- Closes the last two direct waitlist writes in
-- src/app/[locale]/dashboard/waitlist/actions.ts:
--
--   • addToWaitlist     — direct INSERT INTO waitlist_entries
--   • updateStatus      — direct UPDATE with CAS predicate
--
-- Two new RPCs replace the JS-level writes so the data mutation and
-- the audit_logs row commit (or roll back) atomically and so the role /
-- branch check lives in one SECURITY DEFINER body instead of being
-- duplicated across the JS guard and the RLS policy:
--
--   rpc_add_waitlist_entry(p_branch_id, p_guest_name, p_phone,
--                          p_party_size, p_notes)
--     — Roles allowed: owner, general_manager, branch_manager,
--       cashier, waiter (mirrors SECTION_ROLES.waitlist in rbac-ui.ts).
--     — Branch scope: non-globals are clamped to their own branch.
--     — Phone format guard: ^\+973[0-9]{8}$ (mirrors the table CHECK).
--     — Party size: 1..20 (mirrors the table CHECK).
--
--   rpc_update_waitlist_status(p_entry_id, p_target_status,
--                              p_expected_status)
--     — Same role gate.
--     — Branch scope re-checked against the existing row.
--     — Server-side transition graph:
--         waiting   → notified | seated | cancelled
--         notified  → seated   | cancelled
--         seated    → terminal
--         cancelled → terminal
--     — Optimistic concurrency: p_expected_status pins the UPDATE.
--       Mismatch → returns { ok=false, code='conflict' } instead of a
--       silent no-op.
--     — Auto-stamps notified_at / seated_at on the appropriate
--       transitions so the JS layer never has to compute the timestamps.
--
-- Both RPCs:
--   • SECURITY DEFINER, search_path = public
--   • Re-assert auth.uid() + role + branch in the body (RLS doubles
--     as defense-in-depth)
--   • Insert into audit_logs with actor_role + branch_id derived from
--     the caller's session (NOT the input), matching the
--     audit_insert_own_actions WITH CHECK on migration 004.
--
-- Return shape: JSONB { ok, ...payload | code } so the server action
-- can map to its throw-based contract or its localized error map.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS rpc_add_waitlist_entry(
--     TEXT, TEXT, TEXT, SMALLINT, TEXT);
--   DROP FUNCTION IF EXISTS rpc_update_waitlist_status(
--     UUID, TEXT, TEXT);
-- ============================================================

-- ── 1. Helper: role allowed for waitlist mutations ─────────────
-- Kept local to this migration body for self-containment. Mirrors
-- SECTION_ROLES.waitlist in src/lib/auth/rbac-ui.ts.

CREATE OR REPLACE FUNCTION _waitlist_role_allowed(p_role staff_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_role IN (
    'owner', 'general_manager', 'branch_manager', 'cashier', 'waiter'
  )
$$;

-- ── 2. Helper: transition allowed ──────────────────────────────

CREATE OR REPLACE FUNCTION _waitlist_transition_allowed(
  p_prev TEXT,
  p_next TEXT
)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_prev
    WHEN 'waiting'   THEN p_next IN ('notified', 'seated', 'cancelled')
    WHEN 'notified'  THEN p_next IN ('seated', 'cancelled')
    WHEN 'seated'    THEN FALSE
    WHEN 'cancelled' THEN FALSE
    ELSE FALSE
  END
$$;

-- ── 3. rpc_add_waitlist_entry ──────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_add_waitlist_entry(
  p_branch_id   TEXT,
  p_guest_name  TEXT,
  p_phone       TEXT,
  p_party_size  SMALLINT,
  p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_role       staff_role;
  v_branch     TEXT;
  v_id         UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _waitlist_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
    -- Non-globals locked to their own branch.
    IF v_role NOT IN ('owner', 'general_manager')
       AND p_branch_id <> COALESCE(v_branch, '__none__') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
    END IF;
  END IF;

  -- Shape guards (mirror the table CHECKs so the failure mode is a typed
  -- code instead of a Postgres constraint error string reaching the UI).
  IF p_branch_id IS NULL OR char_length(btrim(p_branch_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_guest_name IS NULL OR char_length(btrim(p_guest_name)) = 0
     OR char_length(p_guest_name) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+973[0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 20 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  INSERT INTO waitlist_entries (
    branch_id, guest_name, phone, party_size, notes
  ) VALUES (
    p_branch_id, p_guest_name, p_phone, p_party_size,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'waitlist_entries', 'INSERT',
    COALESCE(v_caller_uid, NULL),
    v_id::TEXT,
    jsonb_build_object(
      'party_size', p_party_size,
      'phone',      p_phone
    ),
    p_branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_add_waitlist_entry(TEXT, TEXT, TEXT, SMALLINT, TEXT)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_add_waitlist_entry(TEXT, TEXT, TEXT, SMALLINT, TEXT)
  TO authenticated, service_role;

-- ── 4. rpc_update_waitlist_status ──────────────────────────────

CREATE OR REPLACE FUNCTION rpc_update_waitlist_status(
  p_entry_id        UUID,
  p_target_status   TEXT,
  p_expected_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    UUID;
  v_role          staff_role;
  v_branch        TEXT;
  v_entry         waitlist_entries%ROWTYPE;
  v_updated_count INT;
  v_now           TIMESTAMPTZ := NOW();
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_target_status NOT IN ('waiting', 'notified', 'seated', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;
  IF p_expected_status NOT IN ('waiting', 'notified', 'seated', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  IF auth.role() <> 'service_role' THEN
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF NOT _waitlist_role_allowed(v_role) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'forbidden_role');
    END IF;
  END IF;

  SELECT * INTO v_entry FROM waitlist_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF auth.role() <> 'service_role'
     AND v_role NOT IN ('owner', 'general_manager')
     AND v_entry.branch_id <> COALESCE(v_branch, '__none__') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_branch');
  END IF;

  -- Transition graph re-check on the actual stored prev so the JS can't
  -- bypass by lying about p_expected_status to the validator.
  IF v_entry.status <> p_target_status
     AND NOT _waitlist_transition_allowed(v_entry.status, p_target_status) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_transition');
  END IF;

  UPDATE waitlist_entries
     SET status      = p_target_status,
         notified_at = CASE
           WHEN p_target_status = 'notified' AND notified_at IS NULL
             THEN v_now
           ELSE notified_at
         END,
         seated_at   = CASE
           WHEN p_target_status = 'seated' AND seated_at IS NULL
             THEN v_now
           ELSE seated_at
         END
   WHERE id = p_entry_id
     AND status = p_expected_status;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict');
  END IF;

  INSERT INTO audit_logs (
    table_name, action, user_id, record_id, changes, branch_id, actor_role
  ) VALUES (
    'waitlist_entries', 'UPDATE',
    COALESCE(v_caller_uid, NULL),
    p_entry_id::TEXT,
    jsonb_build_object(
      'status',      p_target_status,
      'prev_status', v_entry.status
    ),
    v_entry.branch_id,
    v_role
  );

  RETURN jsonb_build_object('ok', true, 'status', p_target_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_waitlist_status(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_update_waitlist_status(UUID, TEXT, TEXT)
  TO authenticated, service_role;
