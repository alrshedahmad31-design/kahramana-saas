-- ============================================================
-- Kahramana Baghdad
-- Migration: 162_customer_membership_id.sql
-- Date: 2026-05-16
--
-- Adds a deterministic, stable membership_id column to customer_profiles
-- and extends read access to the waiter / cashier roles so the
-- lookupMemberByQR server action (src/app/[locale]/waiter/actions.ts) can
-- swap from a `id::text ILIKE 'xxxxxx%'` prefix scan to a UNIQUE-indexed
-- equality lookup.
--
-- Generated-column formula matches the QR payload emitted today by
-- src/components/loyalty/MembershipCard.tsx:
--   `KAH-${uuid.replace(/-/g, '').slice(0, 6).toUpperCase()}`
-- Since UUID positions 1-8 are always hex (the first hyphen sits at
-- position 9), substring(id::text, 1, 6) == replace(id::text,'-','')[0:6]
-- for every well-formed UUID; the upper() matches the existing payload.
--
-- The UNIQUE index closes the 6-hex-collision hole that today's QR format
-- has at ~16M combos. If two existing rows already share a prefix this
-- migration will FAIL at index creation — verified pre-apply (zero
-- collisions in production).
--
-- RLS: a new SELECT-only policy is added so waiter / cashier can read
-- customer_profiles when the QR scanner is enabled. The pre-existing
-- staff_read_customer_profiles policy (FOR ALL, owner/GM/BM/marketing
-- only — migration 008) is left untouched: waiter / cashier remain
-- blocked from UPDATE / DELETE / INSERT.
-- ============================================================

BEGIN;

-- ── Generated column ────────────────────────────────────────────────────────
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS membership_id TEXT
  GENERATED ALWAYS AS (
    'KAH-' || UPPER(SUBSTRING(id::text, 1, 6))
  ) STORED;

-- ── UNIQUE index ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_membership_id
  ON public.customer_profiles (membership_id);

-- ── RLS — waiter / cashier SELECT access ────────────────────────────────────
-- Mirrors staff_read_customer_profiles (008) but FOR SELECT only, and adds
-- waiter / cashier to the allowed staff_basic.role set. Required for the
-- QR scanner flow to use createClient() (RLS) once the flag flips on,
-- replacing the service-role bypass in actions.ts.
DROP POLICY IF EXISTS "waiter_cashier_read_customer_profiles" ON public.customer_profiles;
CREATE POLICY "waiter_cashier_read_customer_profiles"
  ON public.customer_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_basic
      WHERE id = auth.uid()
        AND role IN ('waiter', 'cashier')
        AND is_active = true
    )
  );

COMMIT;
