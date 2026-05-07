-- Migration 069: Hash clock_pin column
-- Security fix: replace plaintext CHAR(4) PINs with SHA-256 hashes (64-char hex)
-- Note: pgcrypto lives in the 'extensions' schema in Supabase — use explicit path.

-- 1. Add the new hash column (idempotent)
ALTER TABLE public.staff_basic
  ADD COLUMN IF NOT EXISTS clock_pin_hash TEXT;

-- 2. Backfill: SHA-256 of each existing plaintext PIN (hex-encoded)
UPDATE public.staff_basic
SET clock_pin_hash = encode(extensions.digest(clock_pin::bytea, 'sha256'), 'hex')
WHERE clock_pin IS NOT NULL
  AND clock_pin_hash IS NULL;

-- 3. Drop the plaintext column
ALTER TABLE public.staff_basic
  DROP COLUMN IF EXISTS clock_pin;

-- Rollback (manual):
-- ALTER TABLE public.staff_basic ADD COLUMN IF NOT EXISTS clock_pin CHAR(4);
-- ALTER TABLE public.staff_basic DROP COLUMN IF EXISTS clock_pin_hash;
