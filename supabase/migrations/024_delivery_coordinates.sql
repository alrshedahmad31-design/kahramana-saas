-- Delivery coordinates + structured address fields for driver distance/ETA display
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_lat') THEN
    ALTER TABLE orders ADD COLUMN delivery_lat DECIMAL(10,8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_lng') THEN
    ALTER TABLE orders ADD COLUMN delivery_lng DECIMAL(11,8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_address') THEN
    ALTER TABLE orders ADD COLUMN delivery_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_instructions') THEN
    ALTER TABLE orders ADD COLUMN delivery_instructions TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='latitude') THEN
    ALTER TABLE branches ADD COLUMN latitude DECIMAL(10,8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='longitude') THEN
    ALTER TABLE branches ADD COLUMN longitude DECIMAL(11,8);
  END IF;
END $$;

UPDATE branches SET latitude = 26.0667, longitude = 50.5577 WHERE id = 'riffa';
UPDATE branches SET latitude = 26.2172, longitude = 50.5865 WHERE id = 'qallali';
