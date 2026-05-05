-- Branch-level service time used on customer order confirmation pages.

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER
  NOT NULL DEFAULT 40
  CHECK (estimated_minutes BETWEEN 5 AND 180);
