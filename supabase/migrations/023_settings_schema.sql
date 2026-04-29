-- Settings infrastructure: business_hours, user_preferences, system_settings
-- Supports: Branch hours per day, per-user preferences, restaurant-wide system toggles

-- ── Business Hours ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_hours (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    TEXT    NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TEXT    NOT NULL DEFAULT '19:00',
  close_time   TEXT    NOT NULL DEFAULT '01:00',
  is_closed    BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, day_of_week)
);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours_read_all"
  ON business_hours FOR SELECT USING (true);

CREATE POLICY "business_hours_write_staff"
  ON business_hours FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── User Preferences ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language           TEXT NOT NULL DEFAULT 'ar',
  theme              TEXT NOT NULL DEFAULT 'dark',
  timezone           TEXT NOT NULL DEFAULT 'Asia/Bahrain',
  date_format        TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  notification_prefs JSONB NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_own_select"
  ON user_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_preferences_own_write"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── System Settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL DEFAULT '{}',
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_read_all"
  ON system_settings FOR SELECT USING (true);

CREATE POLICY "system_settings_write_staff"
  ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO system_settings (key, value) VALUES
  ('payment_methods',  '{"cash": true, "benefit": false, "tap": false}'),
  ('menu_display',     '{"auto_disable_out_of_stock": false, "show_new_badge": true, "show_popular_badge": true, "prices_3_decimals": true, "show_starting_from": true}')
ON CONFLICT (key) DO NOTHING;
