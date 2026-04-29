-- Add delivery tracking fields
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='picked_up_at') THEN
        ALTER TABLE orders ADD COLUMN picked_up_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='arrived_at') THEN
        ALTER TABLE orders ADD COLUMN arrived_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivered_at') THEN
        ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_proof_url') THEN
        ALTER TABLE orders ADD COLUMN delivery_proof_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_signature') THEN
        ALTER TABLE orders ADD COLUMN customer_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_notes') THEN
        ALTER TABLE orders ADD COLUMN delivery_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_location') THEN
        ALTER TABLE orders ADD COLUMN customer_location JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='restaurant_location') THEN
        ALTER TABLE orders ADD COLUMN restaurant_location JSONB;
    END IF;
END $$;

-- Driver earnings tracking
CREATE TABLE IF NOT EXISTS driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES staff(id) NOT NULL,
  order_id UUID REFERENCES orders(id) NOT NULL,
  delivery_fee DECIMAL(10,3) NOT NULL,
  tip DECIMAL(10,3) DEFAULT 0,
  cash_collected DECIMAL(10,3) DEFAULT 0,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver ON driver_earnings(driver_id, earned_at DESC);

-- Enable RLS on driver_earnings
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

-- Driver earnings policies
CREATE POLICY "Drivers can view their own earnings" 
ON driver_earnings FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own earnings" 
ON driver_earnings FOR INSERT 
WITH CHECK (auth.uid() = driver_id);
