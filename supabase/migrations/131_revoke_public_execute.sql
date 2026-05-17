-- ============================================================
-- Kahramana Baghdad — Revoke PUBLIC EXECUTE on rpc_* functions
-- Migration: 131_revoke_public_execute.sql
-- Backfilled: 2026-05-17 from live ACLs (was a 1-line placeholder
--   referring to cowork branch commit 26c059e; the original SQL
--   was never written to the repo).
--
-- WHAT THIS DOES
-- ──────────────────────────────────────────────────────────────
-- Every `public.rpc_*` function below is created with the default
-- Postgres ACL (`GRANT EXECUTE TO PUBLIC`). Even when an RPC is
-- only intended for service_role + authenticated, the default
-- grant makes it callable by `anon` and any future role.
--
-- This migration removes the PUBLIC grant from each named RPC,
-- forcing callers to hold an explicit role grant. The companion
-- migrations 064, 125, 132, 149 add back the precise role grants
-- (authenticated, service_role, etc.) per RPC.
--
-- BEHAVIOUR ON FRESH APPLY
-- ──────────────────────────────────────────────────────────────
-- The block uses a name-based lookup against pg_proc, so:
--   * Functions that don't exist yet at this migration point
--     (e.g. rpc_close_shift / rpc_pos_finalize_order / rpc_refund_payment
--     created in migration 138, rpc_restore_redeemed_loyalty_points
--     created in migration 141) are silently skipped — they get
--     their own REVOKE in the migration that creates them.
--   * All overloads of a given name are revoked together — protects
--     against signature drift across migrations (rpc_create_order
--     has changed signature 4+ times since this migration was first
--     applied via cowork).
--   * REVOKE on an already-revoked function is a Postgres no-op,
--     so re-running is safe.
-- ============================================================

DO $$
DECLARE
  fn_name text;
  fn_oid  oid;
  rpc_names text[] := ARRAY[
    'rpc_auto_generate_pos',
    'rpc_budget_trend',
    'rpc_budget_vs_actual',
    'rpc_catering_calc_ingredients',
    'rpc_catering_confirm',
    'rpc_check_stock_for_cart',
    'rpc_close_shift',
    'rpc_create_customer_profile',
    'rpc_create_order',
    'rpc_create_purchase_order',
    'rpc_create_reservation',
    'rpc_dead_stock_report',
    'rpc_escalate_waste_approvals',
    'rpc_expiry_report',
    'rpc_find_available_tables',
    'rpc_get_driver_location',
    'rpc_inventory_count_session_approve',
    'rpc_inventory_count_submit',
    'rpc_low_stock_alerts',
    'rpc_menu_engineering',
    'rpc_pos_finalize_order',
    'rpc_receive_purchase_order',
    'rpc_record_opening_balance',
    'rpc_refund_payment',
    'rpc_restore_redeemed_loyalty_points',
    'rpc_transfer_stock',
    'rpc_update_abc_classification',
    'rpc_update_staff'
  ];
BEGIN
  FOREACH fn_name IN ARRAY rpc_names LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
        fn_name,
        pg_get_function_identity_arguments(fn_oid)
      );
    END LOOP;
  END LOOP;
END $$;
