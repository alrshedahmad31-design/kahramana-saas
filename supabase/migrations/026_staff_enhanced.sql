-- Add missing columns to staff_basic
ALTER TABLE staff_basic 
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time',
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff_basic(id),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed requested staff for testing if they don't exist
INSERT INTO staff_basic (id, name, role, branch_id, is_active, hire_date, employment_type)
VALUES 
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Ahmad Alrshed', 'branch_manager', 'riffa', true, '2025-01-01', 'full_time'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'Ahmed Algburi', 'kitchen', 'riffa', true, '2025-02-15', 'full_time')
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for staff photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('staff-photos', 'staff-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Staff photos are public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can upload staff photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-photos');
