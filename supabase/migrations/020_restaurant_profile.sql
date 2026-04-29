-- Restaurant profile — single-row settings table (one per deployment)
CREATE TABLE IF NOT EXISTS restaurant_profile (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name_ar      TEXT        NOT NULL DEFAULT 'كهرمانة بغداد',
  restaurant_name_en      TEXT        NOT NULL DEFAULT 'Kahramana Baghdad',
  logo_url                TEXT,
  email                   TEXT,
  phone                   TEXT,
  commercial_registration TEXT,
  tax_number              TEXT,
  description_ar          TEXT,
  description_en          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ENABLE ROW LEVEL SECURITY ON restaurant_profile;

-- All authenticated staff can read
CREATE POLICY "rp_select"
  ON restaurant_profile FOR SELECT
  TO authenticated
  USING (true);

-- Only owner / general_manager can write
CREATE POLICY "rp_write"
  ON restaurant_profile FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE staff_basic.id   = auth.uid()
        AND staff_basic.role IN ('owner', 'general_manager')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_restaurant_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restaurant_profile_updated_at
  BEFORE UPDATE ON restaurant_profile
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_profile_updated_at();

-- Seed one row so upsert works without needing to know the id
INSERT INTO restaurant_profile (restaurant_name_ar, restaurant_name_en)
VALUES ('كهرمانة بغداد', 'Kahramana Baghdad')
ON CONFLICT DO NOTHING;
