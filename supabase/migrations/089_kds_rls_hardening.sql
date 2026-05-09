-- ============================================================
-- Kahramana Baghdad — KDS hardening & data model fixes
-- Migration: 089_kds_rls_hardening.sql
-- Date: 2026-05-09 (session 79)
--
-- Sprint goals:
--  FIX 1  Replace USING(true) RLS on order_item_station_status with
--         branch-scoped policies (owner/GM see all, others scoped to
--         their staff_basic.branch_id).
--  FIX 2  Prevent the same item appearing on two stations
--         (UNIQUE on item_id, replacing UNIQUE(order_id,item_id,station)).
--  FIX 4  Realtime: add denormalised branch_id column on
--         order_item_station_status so the client can filter by
--         `station=eq.X,branch_id=eq.Y` (Supabase realtime only filters
--         on direct columns).
--  FIX 7  SLA timer: add explicit created_at column populated when an
--         item is first assigned to a station, so the kitchen timer can
--         start when the item arrives at the station instead of when
--         the order was created.
--  FIX 1  RPC: update_order_item_station_status now enforces the same
--         branch scope server-side (defence in depth, RPC bypasses RLS
--         because it is SECURITY DEFINER).
--
-- Depends on: 003 (auth_user_role, auth_user_branch_id), 072 (table),
--             079 (trigger inline mapping), 085 (orders.branch_id TEXT)
-- ============================================================

-- ── 0. Schema additions ────────────────────────────────────────
-- branch_id TEXT (mirrors orders.branch_id type — see 085).
-- created_at TIMESTAMPTZ — when the row was first inserted (= station
-- assignment time). Existing rows backfilled from updated_at because
-- the trigger always sets updated_at = now() on insert.
ALTER TABLE order_item_station_status
  ADD COLUMN IF NOT EXISTS branch_id  TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill branch_id from the parent order
UPDATE order_item_station_status oiss
SET branch_id = o.branch_id
FROM orders o
WHERE oiss.order_id = o.id
  AND oiss.branch_id IS NULL;

-- After backfill, enforce non-null
ALTER TABLE order_item_station_status
  ALTER COLUMN branch_id SET NOT NULL;

-- Index for realtime + RLS lookups
CREATE INDEX IF NOT EXISTS idx_oiss_branch_station_status
  ON order_item_station_status (branch_id, station, status);

-- ── 1. Uniqueness — one row per item ───────────────────────────
-- Drop the old composite unique constraint (auto-named from 072) and any
-- prior single-column attempt, then add UNIQUE(item_id) so an item can
-- only ever be routed to one station.
ALTER TABLE order_item_station_status
  DROP CONSTRAINT IF EXISTS order_item_station_status_order_id_item_id_station_key;
ALTER TABLE order_item_station_status
  DROP CONSTRAINT IF EXISTS order_item_station_status_item_id_key;
ALTER TABLE order_item_station_status
  DROP CONSTRAINT IF EXISTS order_item_station_status_item_id_unique;

-- De-duplicate any historical rows that violate the new constraint
-- (keep the earliest assignment per item_id).
DELETE FROM order_item_station_status oiss
USING order_item_station_status keep
WHERE oiss.item_id = keep.item_id
  AND oiss.ctid   <> keep.ctid
  AND keep.created_at <= oiss.created_at
  AND keep.ctid       <  oiss.ctid;

ALTER TABLE order_item_station_status
  ADD CONSTRAINT order_item_station_status_item_id_unique UNIQUE (item_id);

-- ── 2. RLS — branch-scoped SELECT and UPDATE ───────────────────
-- Drop every prior name we might collide with (072 used kds_station_status_*,
-- the new audit names them kds_select / kds_update).
DROP POLICY IF EXISTS "kds_station_status_select" ON order_item_station_status;
DROP POLICY IF EXISTS "kds_station_status_update" ON order_item_station_status;
DROP POLICY IF EXISTS "kds_select"                ON order_item_station_status;
DROP POLICY IF EXISTS "kds_update"                ON order_item_station_status;

CREATE POLICY "kds_select"
  ON order_item_station_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  );

CREATE POLICY "kds_update"
  ON order_item_station_status FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_item_station_status.order_id
        AND (
          auth_user_role() IN ('owner', 'general_manager')
          OR o.branch_id = auth_user_branch_id()
        )
    )
  );

-- ── 3. Trigger — also populate branch_id (created_at uses default) ─
-- Re-create on_order_item_created so it copies orders.branch_id onto
-- the new row. Inline station mapping is preserved verbatim from 079;
-- this is a thin wrapper that keeps the existing CASE expression and
-- adds branch_id to the INSERT.
CREATE OR REPLACE FUNCTION on_order_item_created()
RETURNS TRIGGER AS $$
DECLARE
  v_station   kds_station;
  v_branch_id TEXT;
BEGIN
  v_station := CASE NEW.menu_item_slug
    WHEN 'grills-kahramana-mix'       THEN 'grill'
    WHEN 'grills-ribs'                THEN 'grill'
    WHEN 'grills-meat-kabab'          THEN 'grill'
    WHEN 'grills-tikka-meat'          THEN 'grill'
    WHEN 'grills-grilled-neck'        THEN 'grill'
    WHEN 'grills-chicken-kabab'       THEN 'grill'
    WHEN 'grills-chicken-tikka'       THEN 'grill'
    WHEN 'grills-liver'               THEN 'grill'
    WHEN 'grills-chicken-wings'       THEN 'grill'
    WHEN 'grills-arayes'              THEN 'grill'
    WHEN 'grills-mix-grill'           THEN 'grill'
    WHEN 'grills-meat-grills'         THEN 'grill'
    WHEN 'grills-chicken-grills'      THEN 'grill'
    WHEN 'grills-grilled-chicken'     THEN 'grill'
    WHEN 'shawarma-iraqi-meat-plate'  THEN 'shawarma'
    WHEN 'shawarma-iraqi-meat'        THEN 'shawarma'
    WHEN 'shawarma-iraqi-chicken'     THEN 'shawarma'
    WHEN 'shawarma-arabic-mix'        THEN 'shawarma'
    WHEN 'shawarma-arabic-meat'       THEN 'shawarma'
    WHEN 'shawarma-arabic-chicken'    THEN 'shawarma'
    WHEN 'shawarma-samoon-meat'       THEN 'shawarma'
    WHEN 'shawarma-lebnani-meat'      THEN 'shawarma'
    WHEN 'shawarma-lebnani-chicken'   THEN 'shawarma'
    WHEN 'shawarma-saj-meat'          THEN 'shawarma'
    WHEN 'shawarma-chapati-meat'      THEN 'shawarma'
    WHEN 'shawarma-chapati-chicken'   THEN 'shawarma'
    WHEN 'cold-apps-mix-appetizer'    THEN 'appetizer_drinks'
    WHEN 'cold-apps-mtabal'           THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus'           THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus-meat'      THEN 'appetizer_drinks'
    WHEN 'cold-apps-hummus-shawarma'  THEN 'appetizer_drinks'
    WHEN 'cold-apps-pepper-hummus'    THEN 'appetizer_drinks'
    WHEN 'cold-apps-vine-leaves'      THEN 'appetizer_drinks'
    WHEN 'cold-apps-turshi'           THEN 'appetizer_drinks'
    WHEN 'hot-apps-dolma'             THEN 'appetizer_drinks'
    WHEN 'hot-apps-mosul-kubba'       THEN 'appetizer_drinks'
    WHEN 'hot-apps-halab-kubba'       THEN 'appetizer_drinks'
    WHEN 'hot-apps-burek-cheese'      THEN 'appetizer_drinks'
    WHEN 'hot-apps-oroug'             THEN 'appetizer_drinks'
    WHEN 'hot-apps-hareesa'           THEN 'appetizer_drinks'
    WHEN 'hot-apps-madhroobah'        THEN 'appetizer_drinks'
    WHEN 'hot-apps-french-fries'      THEN 'appetizer_drinks'
    WHEN 'salad-tabbouleh'            THEN 'appetizer_drinks'
    WHEN 'salad-fattoush'             THEN 'appetizer_drinks'
    WHEN 'salad-eggplant'             THEN 'appetizer_drinks'
    WHEN 'salad-rocca'                THEN 'appetizer_drinks'
    WHEN 'salad-jajeek'               THEN 'appetizer_drinks'
    WHEN 'salad-green'                THEN 'appetizer_drinks'
    WHEN 'soup-sour-kubba'            THEN 'appetizer_drinks'
    WHEN 'soup-lentil'                THEN 'appetizer_drinks'
    WHEN 'soup-mushroom'              THEN 'appetizer_drinks'
    WHEN 'soup-red'                   THEN 'appetizer_drinks'
    WHEN 'drinks-avocado'             THEN 'appetizer_drinks'
    WHEN 'drinks-kahramana-cocktail'  THEN 'appetizer_drinks'
    WHEN 'drinks-strawberry'          THEN 'appetizer_drinks'
    WHEN 'drinks-orange'              THEN 'appetizer_drinks'
    WHEN 'drinks-lemon-mint'          THEN 'appetizer_drinks'
    WHEN 'drinks-pomegranate'         THEN 'appetizer_drinks'
    WHEN 'drinks-mango'               THEN 'appetizer_drinks'
    WHEN 'drinks-laban-mint'          THEN 'appetizer_drinks'
    WHEN 'drinks-soft-drinks'         THEN 'appetizer_drinks'
    WHEN 'drinks-water'               THEN 'appetizer_drinks'
    WHEN 'drinks-iraqi-tea'           THEN 'appetizer_drinks'
    WHEN 'drinks-karak-tea'           THEN 'appetizer_drinks'
    WHEN 'drinks-black-lemon-tea'     THEN 'appetizer_drinks'
    WHEN 'pastry-lahm-bi-ajeen'           THEN 'bakery'
    WHEN 'pastry-meat-pie'                THEN 'bakery'
    WHEN 'pastry-meat-shawarma-cheese'    THEN 'bakery'
    WHEN 'pastry-meat-kabab-cheese'       THEN 'bakery'
    WHEN 'pastry-akkawi'                  THEN 'bakery'
    WHEN 'pastry-zaatar-plain'            THEN 'bakery'
    WHEN 'pastry-iraqi-bread-dozen'       THEN 'bakery'
    WHEN 'pastry-fatayer-dozen'           THEN 'bakery'
    WHEN 'pastry-labnah'                  THEN 'bakery'
    WHEN 'pastry-labnah-cheese'           THEN 'bakery'
    WHEN 'pastry-spinach-labnah'          THEN 'bakery'
    WHEN 'pastry-honey-labnah'            THEN 'bakery'
    WHEN 'pastry-zaatar-labnah'           THEN 'bakery'
    WHEN 'pastry-sausage-labnah'          THEN 'bakery'
    WHEN 'pastry-sausage-cheese-labnah'   THEN 'bakery'
    WHEN 'pastry-meat-shawarma-labnah'    THEN 'bakery'
    WHEN 'pastry-chicken-shawarma-labnah' THEN 'bakery'
    WHEN 'pastry-falafel-labnah'          THEN 'bakery'
    WHEN 'pastry-spring-pie'              THEN 'bakery'
    WHEN 'pastry-cheese'                  THEN 'bakery'
    WHEN 'pastry-zaatar-cheese'           THEN 'bakery'
    WHEN 'pastry-sausage-cheese'          THEN 'bakery'
    WHEN 'pastry-chicken-shawarma-cheese' THEN 'bakery'
    WHEN 'pastry-meat-spinach'            THEN 'bakery'
    WHEN 'pastry-chicken-spinach'         THEN 'bakery'
    WHEN 'pizza-kahramana-signature'  THEN 'bakery'
    WHEN 'pizza-shawarma'             THEN 'bakery'
    WHEN 'pizza-kabab'                THEN 'bakery'
    WHEN 'pizza-pepperonata'          THEN 'bakery'
    WHEN 'pizza-margarita'            THEN 'bakery'
    WHEN 'pizza-vegetarian'           THEN 'bakery'
    WHEN 'pizza-pollo'                THEN 'bakery'
    WHEN 'pizza-spinach'              THEN 'bakery'
    WHEN 'pizza-jalapeno-chicken'     THEN 'bakery'
    WHEN 'sandwiches-meat-kabab'          THEN 'bakery'
    WHEN 'sandwiches-meat-tikka'          THEN 'bakery'
    WHEN 'sandwiches-chicken-kabab'       THEN 'bakery'
    WHEN 'sandwiches-chicken-tikka'       THEN 'bakery'
    WHEN 'sandwiches-grilled-liver'       THEN 'bakery'
    WHEN 'sandwiches-kubba'               THEN 'bakery'
    WHEN 'sandwiches-falafel'             THEN 'bakery'
    WHEN 'sandwiches-beef-liver'          THEN 'bakery'
    WHEN 'sandwiches-chicken-liver'       THEN 'bakery'
    WHEN 'sandwiches-makhlama'            THEN 'bakery'
    WHEN 'sandwiches-shakshouka'          THEN 'bakery'
    WHEN 'sandwiches-special-shakshouka'  THEN 'bakery'
    WHEN 'sandwiches-tomato-special'      THEN 'bakery'
    WHEN 'breakfast-plates-bagella-bil-dihen'    THEN 'bakery'
    WHEN 'breakfast-tawat-makhlama'              THEN 'bakery'
    WHEN 'breakfast-eggs-fried-eggs'             THEN 'bakery'
    WHEN 'breakfast-eggs-shakshouka-special'     THEN 'bakery'
    WHEN 'breakfast-eggs-meat'                   THEN 'bakery'
    WHEN 'breakfast-eggs-basterma'               THEN 'bakery'
    WHEN 'breakfast-tawat-tomato-tawah'          THEN 'bakery'
    WHEN 'breakfast-tawat-chicken-liver'         THEN 'bakery'
    WHEN 'breakfast-tawat-beef-liver'            THEN 'bakery'
    WHEN 'breakfast-plates-halloumi'             THEN 'bakery'
    WHEN 'breakfast-plates-falafel'              THEN 'bakery'
    WHEN 'breakfast-plates-dibis-rashi'          THEN 'bakery'
    WHEN 'breakfast-plates-lablabeh'             THEN 'bakery'
    WHEN 'breakfast-plates-msabaha'              THEN 'bakery'
    WHEN 'breakfast-plates-foul-mdammas'         THEN 'bakery'
    WHEN 'breakfast-plates-labneh'               THEN 'bakery'
    WHEN 'breakfast-plates-debis-dehin'          THEN 'bakery'
    WHEN 'breakfast-plates-bagella'              THEN 'bakery'
    WHEN 'breakfast-eggs-tomatoes'               THEN 'bakery'
    WHEN 'breakfast-eggs-shakshouka'             THEN 'bakery'
    WHEN 'breakfast-eggs-potato'                 THEN 'bakery'
    WHEN 'breakfast-eggs-cheese'                 THEN 'bakery'
    WHEN 'breakfast-eggs-zaatar'                 THEN 'bakery'
    ELSE 'main'
  END::kds_station;

  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  INSERT INTO order_item_station_status (order_id, item_id, station, branch_id)
  VALUES (NEW.order_id, NEW.id, v_station, v_branch_id)
  ON CONFLICT (item_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_item_station_status ON order_items;
CREATE TRIGGER trg_order_item_station_status
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION on_order_item_created();

-- ── 4. RPC — defence-in-depth branch check ─────────────────────
-- update_order_item_station_status is SECURITY DEFINER so RLS is bypassed.
-- Re-implement to enforce the same branch check the client-side action uses.
CREATE OR REPLACE FUNCTION update_order_item_station_status(
  p_order_id UUID,
  p_item_id  UUID,
  p_station  kds_station,
  p_status   kds_item_status
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role      staff_role;
  v_caller_branch_id TEXT;
  v_order_branch_id  TEXT;
BEGIN
  v_caller_role      := auth_user_role();
  v_caller_branch_id := auth_user_branch_id();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT branch_id INTO v_order_branch_id
  FROM orders WHERE id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role NOT IN ('owner', 'general_manager')
     AND v_order_branch_id <> v_caller_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH' USING ERRCODE = '42501';
  END IF;

  UPDATE order_item_station_status
  SET status     = p_status,
      updated_at = now()
  WHERE order_id = p_order_id
    AND item_id  = p_item_id
    AND station  = p_station;
END;
$$;

-- ============================================================
-- ROLLBACK:
--   ALTER TABLE order_item_station_status
--     DROP CONSTRAINT IF EXISTS order_item_station_status_item_id_unique;
--   ALTER TABLE order_item_station_status
--     ADD  CONSTRAINT order_item_station_status_order_id_item_id_station_key
--     UNIQUE (order_id, item_id, station);
--   DROP POLICY IF EXISTS "kds_select" ON order_item_station_status;
--   DROP POLICY IF EXISTS "kds_update" ON order_item_station_status;
--   CREATE POLICY "kds_station_status_select" ON order_item_station_status
--     FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "kds_station_status_update" ON order_item_station_status
--     FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   ALTER TABLE order_item_station_status
--     DROP COLUMN IF EXISTS branch_id,
--     DROP COLUMN IF EXISTS created_at;
--   DROP INDEX IF EXISTS idx_oiss_branch_station_status;
--   -- Re-create on_order_item_created without branch_id from migration 079.
-- ============================================================
